import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPostmarkWebhook } from "@/lib/postmark-webhook-auth";

type PostmarkEvent = {
  RecordType?: string;
  // Engagement events carry `Recipient`; delivery events carry `Email`.
  // Postmark is genuinely inconsistent here.
  Recipient?: string;
  Email?: string;
  ReceivedAt?: string;
  BouncedAt?: string;
  SuppressSending?: boolean;
  SuppressionReason?: string;
};

function contactUpdate(event: PostmarkEvent, leadId: string) {
  const at = new Date(event.ReceivedAt ?? event.BouncedAt ?? Date.now());

  switch (event.RecordType) {
    case "Open":
      // Only SENT/PENDING advance to OPENED so a contact that already clicked
      // is not walked backwards by a later open.
      return {
        where: { leadId, status: { in: ["SENT", "PENDING"] } },
        data: { status: "OPENED", openedAt: at },
      };
    case "Click":
      return {
        where: { leadId, status: { not: "BOUNCED" } },
        data: { status: "CLICKED", clickedAt: at },
      };
    case "Bounce":
    case "SpamComplaint":
      return { where: { leadId }, data: { status: "BOUNCED" } };
    default:
      return null;
  }
}

// A hard bounce means the address is gone; a complaint means stop entirely.
// Either way every category is suppressed. Reactivations are deliberately not
// handled: with no stored reason we cannot tell someone who opted out from
// someone who merely bounced, and clearing the flag would put a person who
// asked to leave back on the list. Recipients can resubscribe themselves —
// the signed token in any past email still works.
const SUPPRESSING_REASONS = new Set(["HardBounce", "SpamComplaint"]);

async function applySuppression(email: string) {
  // Case-insensitive because nothing lowercases on write, so a lead who typed
  // `John@Example.com` is stored with that casing and a `=` match would miss
  // them entirely — Postgres `=` on TEXT is case-sensitive.
  const where = { email: { equals: email, mode: "insensitive" as const } };

  // updateMany, not findFirst + update: `Lead.email` is not unique and no
  // creation path dedupes, so one person who submitted two forms has two rows.
  // Flagging only the first leaves the dead address mailable through the other.
  // Property alerts go to Users, so that table is always covered too — the same
  // address can exist in both, when a lead later registers.
  await Promise.all([
    prisma.lead.updateMany({
      where,
      data: { campaignOptOut: true, actionPlanOptOut: true },
    }),
    prisma.user.updateMany({
      where,
      data: { propertyAlertOptOut: true },
    }),
  ]);
}

export async function POST(req: Request) {
  if (!isAuthorizedPostmarkWebhook(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // One event per request. SendGrid posted an array; Postmark does not.
    const event: PostmarkEvent = await req.json();

    const email = (event.Recipient ?? event.Email ?? "").toLowerCase().trim();
    if (!email) return NextResponse.json({ ok: true });

    // Additive to the Bounce/SpamComplaint handling below, which updates a
    // single CampaignContact. This sets the durable per-person flag — without
    // it a bounced address is mailable again on the next campaign, because
    // that campaign creates fresh PENDING contact rows.
    if (event.RecordType === "SubscriptionChange") {
      if (
        event.SuppressSending === true &&
        SUPPRESSING_REASONS.has(event.SuppressionReason ?? "")
      ) {
        await applySuppression(email);
      }
      return NextResponse.json({ ok: true });
    }

    const lead = await prisma.lead.findFirst({ where: { email } });
    if (!lead) return NextResponse.json({ ok: true });

    const update = contactUpdate(event, lead.id);
    if (!update) return NextResponse.json({ ok: true });

    await prisma.campaignContact.updateMany(
      update as Parameters<typeof prisma.campaignContact.updateMany>[0]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 200 on internal errors so Postmark does not retry the same payload
    // forever — same reasoning as the SendGrid route this replaces.
    console.error("[postmark-webhook] failed", err);
    return NextResponse.json({ ok: true });
  }
}
