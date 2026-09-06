import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailLayout, escapeHtml, buildHeadingBodyHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";
import { ensureQuotaReset, tryConsumeEmailQuota } from "@/lib/email-quota";
import { paragraph } from "@/lib/action-plan-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.POSTMARK_SERVER_TOKEN) {
    return NextResponse.json({ error: "POSTMARK_SERVER_TOKEN not configured" }, { status: 500 });
  }

  // Preflight, not per-delivery: the seam throws for an unconfigured broadcast
  // stream, and the per-delivery catch below would bury that throw as N
  // failures — a 200 response reporting only `errors`, with nothing delivered.
  // Fail here, before any state mutation, so a misconfigured deploy is loud.
  if (!process.env.POSTMARK_BROADCAST_STREAM) {
    return NextResponse.json({ error: "POSTMARK_BROADCAST_STREAM not configured" }, { status: 500 });
  }

  // Same reasoning: unsubscribe links are signed with this, so without it every
  // recipient throws inside the per-delivery catch and the run reports success
  // having delivered nothing.
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET not configured" }, { status: 500 });
  }

  // The quietest failure of the four: unset, the URL builders interpolate the
  // literal string "undefined", so every message ships a List-Unsubscribe
  // header and a footer link pointing at `undefined/...`. Postmark enforces
  // that the header is present, not that it resolves — so this sends
  // successfully with a dead opt-out link, which is worse than not sending.
  if (!process.env.NEXTAUTH_URL) {
    return NextResponse.json({ error: "NEXTAUTH_URL not configured" }, { status: 500 });
  }

  const now = new Date();

  // Pre-mark: a lead who opted out since their delivery was materialized is
  // flagged here, mirroring the same pattern in /send. Without this, the
  // main query below would simply never select these rows again — they'd
  // stay PENDING forever instead of resolving to a terminal state, and their
  // contact/campaign could never roll up to SENT/COMPLETED.
  await prisma.campaignDelivery.updateMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now },
      campaignContact: { lead: { campaignOptOut: true } },
    },
    data: { status: "SKIPPED", executedAt: now },
  });

  const dueDeliveries = await prisma.campaignDelivery.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now },
      campaignContact: { lead: { campaignOptOut: false } },
    },
    take: 500,
    include: {
      campaignContact: {
        include: {
          lead: { select: { id: true, email: true } },
          campaign: {
            select: {
              id: true,
              agentId: true,
              subject: true,
              heading: true,
              body: true,
              agent: { select: { monthlyEmailLimit: true } },
            },
          },
        },
      },
      dripStep: { select: { id: true, subject: true, heading: true, body: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const agentIds = Array.from(
    new Set(dueDeliveries.map((d) => d.campaignContact.campaign.agentId).filter((id): id is string => !!id))
  );
  await Promise.all(agentIds.map((id) => ensureQuotaReset(id, now)));

  const results = await Promise.all(
    dueDeliveries.map(async (delivery): Promise<"processed" | "error" | "skipped-limit"> => {
      let quotaConsumed = false;
      try {
        const { campaignContact, dripStep } = delivery;
        const { lead, campaign } = campaignContact;
        if (!campaign.agentId || !campaign.agent) {
          await prisma.campaignDelivery.update({ where: { id: delivery.id }, data: { status: "ERROR", executedAt: now } });
          return "error";
        }

        const quotaAvailable = await tryConsumeEmailQuota(campaign.agentId, campaign.agent.monthlyEmailLimit);
        if (!quotaAvailable) {
          return "skipped-limit";
        }
        quotaConsumed = true;

        const subject = dripStep ? dripStep.subject : campaign.subject ?? "";
        const heading = dripStep ? (dripStep.heading || dripStep.subject) : (campaign.heading || campaign.subject) ?? "";
        const innerHtml = dripStep
          ? paragraph(dripStep.body ?? "")
          : campaign.body ?? "";
        const html = emailLayout({
          heading: "",
          bodyHtml:
            buildHeadingBodyHtml({ heading: escapeHtml(heading), bodyHtml: innerHtml }) +
            unsubscribeFooterHtml("lead", lead.id, "campaign"),
        });

        const result = await sendEmail({
          to: lead.email,
          subject,
          html,
          stream: "broadcast",
          recipient: { kind: "lead", id: lead.id },
          category: "campaign",
        });

        if (!result.sent) {
          // Quota was already consumed above; refund it since the message
          // never actually went out. Mirrors cron/action-plans/route.ts.
          quotaConsumed = false;
          await prisma.agent.updateMany({
            where: { id: campaign.agentId, monthlyEmailsSent: { gt: 0 } },
            data: { monthlyEmailsSent: { decrement: 1 } },
          });
          await prisma.campaignDelivery.update({
            where: { id: delivery.id },
            data: { status: "SKIPPED", executedAt: now },
          });
          return "processed";
        }

        await prisma.campaignDelivery.update({
          where: { id: delivery.id },
          data: { status: "SENT", executedAt: now },
        });
        return "processed";
      } catch (e) {
        // Left PENDING, not marked ERROR: a transient failure here (network
        // blip, a momentary Postmark 500) should retry on the next hourly
        // run, not be permanently dropped. The next run's `dueAt <= now`
        // query re-selects it automatically.
        //
        // Quota may have already been consumed above (tryConsumeEmailQuota
        // succeeded, then something below it threw) — refund it here too,
        // mirroring the !result.sent branch. Without this, a delivery that
        // keeps failing leaks one quota unit every hourly retry instead of
        // once. Guarded by quotaConsumed (not just agentId) so an exception
        // thrown before or during tryConsumeEmailQuota itself — where no
        // quota was ever taken — doesn't trigger a bogus refund.
        if (quotaConsumed) {
          const agentId = delivery.campaignContact.campaign.agentId;
          if (agentId) {
            await prisma.agent.updateMany({
              where: { id: agentId, monthlyEmailsSent: { gt: 0 } },
              data: { monthlyEmailsSent: { decrement: 1 } },
            });
          }
        }
        console.error(`[campaign-deliveries-cron] delivery ${delivery.id} failed:`, e);
        return "error";
      }
    })
  );

  let processed = 0;
  let errors = 0;
  let skippedLimit = 0;
  for (const r of results) {
    if (r === "processed") processed++;
    else if (r === "error") errors++;
    else skippedLimit++;
  }

  // Status rollup — run for every distinct contact/campaign touched this run,
  // regardless of outcome, since a delivery that errored still needs its
  // contact/campaign re-evaluated.
  const contactIds = Array.from(new Set(dueDeliveries.map((d) => d.campaignContact.id)));
  await Promise.all(
    contactIds.map((id) =>
      prisma.campaignContact.updateMany({
        where: {
          id,
          status: "PENDING",
          deliveries: { none: { status: "PENDING" } },
          NOT: { deliveries: { some: { status: "SKIPPED" } } },
        },
        data: { status: "SENT" },
      })
    )
  );
  await Promise.all(
    contactIds.map((id) =>
      prisma.campaignContact.updateMany({
        where: {
          id,
          status: "PENDING",
          deliveries: { none: { status: "PENDING" } },
          AND: { deliveries: { some: { status: "SKIPPED" } } },
        },
        data: { status: "UNSUBSCRIBED" },
      })
    )
  );

  // Compute campaign IDs from deliveries that were actually processed or errored
  // (exclude skipped-limit since those never left PENDING status)
  const processedCampaignIds = Array.from(
    new Set(
      dueDeliveries
        .map((d, i) => ({ campaignId: d.campaignContact.campaign.id, outcome: results[i] }))
        .filter((entry) => entry.outcome !== "skipped-limit")
        .map((entry) => entry.campaignId)
    )
  );

  const campaignIds = Array.from(
    new Set(dueDeliveries.map((d) => d.campaignContact.campaign.id))
  );

  // SCHEDULED → ACTIVE the moment a campaign's first delivery actually sends.
  await Promise.all(
    processedCampaignIds.map((id) =>
      prisma.campaign.updateMany({
        where: { id, status: "SCHEDULED" },
        data: { status: "ACTIVE", sentAt: now },
      })
    )
  );
  // ACTIVE → COMPLETED once every delivery across every one of a campaign's
  // contacts is terminal.
  await Promise.all(
    campaignIds.map((id) =>
      prisma.campaign.updateMany({
        where: {
          id,
          status: "ACTIVE",
          contacts: { every: { deliveries: { none: { status: "PENDING" } } } },
        },
        data: { status: "COMPLETED" },
      })
    )
  );

  return NextResponse.json({ processed, skippedLimit, errors });
}

export const GET = POST;
