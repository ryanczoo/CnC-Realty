import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";
import { emailLayout } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaignRecord = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        where: { status: "PENDING" },
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

  let sent = 0;
  let errors = 0;
  const now = new Date();

  const results = await Promise.allSettled(
    campaign.contacts.map(async (contact) => {
      // Built per contact, not once outside the loop: the unsubscribe link is
      // signed for a specific lead, so a shared body would opt the wrong
      // person out.
      const html = emailLayout({
        heading: campaign.subject!,
        bodyHtml: campaign.body! + unsubscribeFooterHtml("lead", contact.lead.id, "campaign"),
      });

      await sendEmail({
        to: contact.lead.email,
        subject: campaign.subject!,
        html,
        stream: "broadcast",
        recipient: { kind: "lead", id: contact.lead.id },
        category: "campaign",
      });
      return contact.id;
    })
  );

  const successIds: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      sent++;
      successIds.push(result.value);
    } else {
      console.error("Failed to send email:", result.reason);
      errors++;
    }
  }

  if (successIds.length > 0) {
    await prisma.campaignContact.updateMany({
      where: { id: { in: successIds } },
      data: { status: "SENT", sentAt: now },
    });
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: now },
  });

  return NextResponse.json({ sent, errors });
}
