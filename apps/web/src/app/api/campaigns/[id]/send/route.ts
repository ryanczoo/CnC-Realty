import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";
import { emailLayout } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";
import { ensureQuotaReset, tryConsumeEmailQuota } from "@/lib/email-quota";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaignRecord = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      agent: { select: { monthlyEmailLimit: true } },
      contacts: {
        // Filter here rather than relying only on the seam's per-send check:
        // that check is one query per recipient inside Promise.allSettled, so
        // a 1,000-lead campaign fired 1,000 concurrent lookups at Neon. The
        // seam still checks, as a backstop against a race between this query
        // and the send.
        where: { status: "PENDING", lead: { campaignOptOut: false } },
        include: { lead: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
    },
  });

  const { exists, forbidden, record: campaign } = checkOwnership(campaignRecord, session.user.agentId, session.user.role);
  if (!exists || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!campaign.subject || !campaign.body) {
    return NextResponse.json(
      { error: "Campaign must have a subject and body before sending" },
      { status: 400 }
    );
  }

  if (!process.env.POSTMARK_SERVER_TOKEN) {
    return NextResponse.json({ error: "POSTMARK_SERVER_TOKEN not configured" }, { status: 500 });
  }

  // Preflight, not per-recipient: the seam throws for an unconfigured broadcast
  // stream, and Promise.allSettled would bury that throw as N send failures —
  // a 200 response and a campaign marked ACTIVE/sentAt with zero delivered.
  // Fail here, before any state mutation, so a misconfigured deploy is loud.
  if (!process.env.POSTMARK_BROADCAST_STREAM) {
    return NextResponse.json(
      { error: "POSTMARK_BROADCAST_STREAM not configured" },
      { status: 500 }
    );
  }

  // Same reasoning: unsubscribe links are signed with this, so without it every
  // recipient throws inside allSettled and the campaign reports success having
  // delivered nothing.
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET not configured" }, { status: 500 });
  }

  // The fourth ingredient of a working unsubscribe, and the quietest failure of
  // the four: unset, the URL builders interpolate the literal string
  // "undefined", so every message ships a List-Unsubscribe header and a footer
  // link pointing at `undefined/...`. Postmark enforces that the header is
  // present, not that it resolves — so this sends successfully with a dead
  // opt-out link, which is worse than not sending at all.
  if (!process.env.NEXTAUTH_URL) {
    return NextResponse.json({ error: "NEXTAUTH_URL not configured" }, { status: 500 });
  }

  // Schema declares agentId/agent optional (no creation path sets them null
  // today), but the batch below dereferences both unconditionally. Guard
  // before the pre-mark updateMany so an invalid campaign mutates nothing.
  if (!campaign.agentId || !campaign.agent) {
    return NextResponse.json({ error: "Campaign has no owning agent" }, { status: 400 });
  }
  // Captured into locals, not read off `campaign` inside the closure below:
  // TypeScript does not carry a narrowed property's type into a nested
  // function, since it cannot prove the property is unchanged by the time
  // the callback runs.
  const agentId = campaign.agentId;
  const monthlyEmailLimit = campaign.agent.monthlyEmailLimit;

  // A lead who unsubscribed from an earlier send is already flagged when the
  // next campaign fires, so the contact query above filters them out and the
  // send loop never sees them — they would sit at PENDING forever and
  // `skipped` would only ever be non-zero inside the query-to-send race
  // window. Mark them in one extra pass instead: two queries total regardless
  // of list size, so the N+1 fix stays intact.
  //
  // Deliberately placed after the ownership and validation gates above. Run
  // earlier, this would mutate contacts on a campaign the caller does not own,
  // and mutate state on a request that then 400s.
  const preMarked = await prisma.campaignContact.updateMany({
    where: {
      campaignId: params.id,
      status: "PENDING",
      lead: { campaignOptOut: true },
    },
    data: { status: "UNSUBSCRIBED" },
  });

  const now = new Date();
  // Once per batch, not once per recipient — see lib/email-quota.ts.
  await ensureQuotaReset(agentId, now);

  const results = await Promise.allSettled(
    campaign.contacts.map(async (contact) => {
      const quotaAvailable = await tryConsumeEmailQuota(agentId, monthlyEmailLimit);
      if (!quotaAvailable) {
        return { contactId: contact.id, outcome: "limit" as const };
      }

      // Built per contact, not once outside the loop: the unsubscribe link is
      // signed for a specific lead, so a shared body would opt the wrong
      // person out.
      //
      // The heading/body styling matches the welcome-agent email (33px
      // centered heading, 22.5px/#4b4b4b body) rather than emailLayout's
      // generic 22px heading slot — kept out of that slot (heading: "")
      // the same way the other custom-styled emails do it. The scoped
      // <style> block sets consistent paragraph spacing on the agent's
      // Tiptap-authored body, which ships its own <p> tags with no inline
      // margin of their own.
      const html = emailLayout({
        heading: "",
        bodyHtml: `
          <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
            ${campaign.subject}
          </h2>
          <style>
            #campaign-content p { margin: 0 0 20px; }
            #campaign-content p:last-child { margin-bottom: 0; }
          </style>
          <div id="campaign-content" style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: left;">
            ${campaign.body}
          </div>
          ${unsubscribeFooterHtml("lead", contact.lead.id, "campaign")}
        `,
      });

      const result = await sendEmail({
        to: contact.lead.email,
        subject: campaign.subject!,
        html,
        stream: "broadcast",
        recipient: { kind: "lead", id: contact.lead.id },
        category: "campaign",
      });

      return { contactId: contact.id, outcome: result.sent ? ("sent" as const) : ("suppressed" as const) };
    })
  );

  let sent = 0;
  // Seeded, not zero: these contacts were suppressed before the loop began.
  let skipped = preMarked.count;
  let skippedLimit = 0;
  let errors = 0;
  const sentIds: string[] = [];
  const skippedIds: string[] = [];

  for (const settled of results) {
    if (settled.status === "rejected") {
      console.error("Failed to send email:", settled.reason);
      errors++;
      continue;
    }

    const { contactId, outcome } = settled.value;
    if (outcome === "sent") {
      sent++;
      sentIds.push(contactId);
    } else if (outcome === "suppressed") {
      skipped++;
      skippedIds.push(contactId);
    } else {
      // "limit" — over quota. Left PENDING (no id pushed to either array),
      // not UNSUBSCRIBED, so a future send of this same campaign retries it.
      skippedLimit++;
    }
  }

  if (sentIds.length > 0) {
    await prisma.campaignContact.updateMany({
      where: { id: { in: sentIds } },
      data: { status: "SENT", sentAt: now },
    });
  }

  if (skippedIds.length > 0) {
    await prisma.campaignContact.updateMany({
      where: { id: { in: skippedIds } },
      data: { status: "UNSUBSCRIBED" },
    });
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: now },
  });

  return NextResponse.json({ sent, skipped, skippedLimit, errors });
}
