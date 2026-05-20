// apps/web/src/app/api/webhooks/sendgrid/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface SendGridEvent {
  email: string;
  event: string;
  timestamp: number;
  [key: string]: unknown;
}

export async function POST(req: Request) {
  try {
    const events: SendGridEvent[] = await req.json();

    for (const event of events) {
      const { email, event: eventType, timestamp } = event;
      const eventDate = new Date(timestamp * 1000);

      // Find the lead by email
      const lead = await prisma.lead.findFirst({ where: { email } });
      if (!lead) continue;

      if (eventType === "open") {
        await prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { in: ["SENT", "PENDING"] } },
          data: { status: "OPENED", openedAt: eventDate },
        });
      } else if (eventType === "click") {
        await prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { not: "BOUNCED" } },
          data: { status: "CLICKED", clickedAt: eventDate },
        });
      } else if (eventType === "bounce" || eventType === "blocked") {
        await prisma.campaignContact.updateMany({
          where: { leadId: lead.id },
          data: { status: "BOUNCED" },
        });
      }
    }
  } catch (err) {
    console.error("SendGrid webhook error:", err);
  }

  // Always return 200 — SendGrid retries on non-200
  return NextResponse.json({ ok: true });
}
