import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailLayout, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";
import { ensureQuotaReset, tryConsumeEmailQuota } from "@/lib/email-quota";
import { paragraph } from "@/lib/action-plan-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Duplicated from campaigns/[id]/send/route.ts deliberately — Task 9 extracts
// both into one shared helper once the heading field exists. Kept identical
// to that route's markup so a scheduled/drip email looks the same as an
// immediately-sent one.
function buildBodyHtml(heading: string, innerHtml: string): string {
  return `
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
      ${heading}
    </h2>
    <style>
      #campaign-content p { margin: 0 0 20px; }
      #campaign-content p:last-child { margin-bottom: 0; }
    </style>
    <div id="campaign-content" style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: left;">
      ${innerHtml}
    </div>
  `;
}

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueDeliveries = await prisma.campaignDelivery.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    include: {
      campaignContact: {
        include: {
          lead: { select: { id: true, email: true } },
          campaign: {
            select: {
              id: true,
              agentId: true,
              subject: true,
              body: true,
              agent: { select: { monthlyEmailLimit: true } },
            },
          },
        },
      },
      dripStep: { select: { id: true, subject: true, body: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const agentIds = Array.from(
    new Set(dueDeliveries.map((d) => d.campaignContact.campaign.agentId).filter((id): id is string => !!id))
  );
  await Promise.all(agentIds.map((id) => ensureQuotaReset(id, now)));

  const results = await Promise.all(
    dueDeliveries.map(async (delivery): Promise<"processed" | "error" | "skipped-limit"> => {
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

        const subject = dripStep ? dripStep.subject : campaign.subject ?? "";
        const innerHtml = dripStep
          ? paragraph(dripStep.body ?? "")
          : campaign.body ?? "";
        const html = emailLayout({
          heading: "",
          bodyHtml:
            buildBodyHtml(escapeHtml(subject), innerHtml) +
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
        console.error(`[campaign-deliveries-cron] delivery ${delivery.id} failed:`, e);
        await prisma.campaignDelivery
          .update({ where: { id: delivery.id }, data: { status: "ERROR", executedAt: now } })
          .catch(() => {});
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
        where: { id, deliveries: { none: { status: "PENDING" } } },
        data: { status: "SENT" },
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
