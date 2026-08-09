import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// Postmark authenticates webhooks with HTTP Basic Auth embedded in the endpoint
// URL, not a signed payload the way SendGrid did.
function authorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const user = process.env.POSTMARK_WEBHOOK_USER;
  const pass = process.env.POSTMARK_WEBHOOK_PASSWORD;
  if (!user || !pass) return false;

  const expected = Buffer.from("Basic " + Buffer.from(`${user}:${pass}`).toString("base64"));
  const given = Buffer.from(header);
  // Length check first: timingSafeEqual throws on a length mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type PostmarkEvent = {
  RecordType?: string;
  // Engagement events carry `Recipient`; delivery events carry `Email`.
  // Postmark is genuinely inconsistent here.
  Recipient?: string;
  Email?: string;
  ReceivedAt?: string;
  BouncedAt?: string;
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

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // One event per request. SendGrid posted an array; Postmark does not.
    const event: PostmarkEvent = await req.json();

    const email = (event.Recipient ?? event.Email ?? "").toLowerCase().trim();
    if (!email) return NextResponse.json({ ok: true });

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
