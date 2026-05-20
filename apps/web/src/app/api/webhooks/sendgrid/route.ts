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

    // Batch lead lookups — one query for all unique emails
    const emails = Array.from(new Set(events.map((e) => e.email)));
    const leads = await prisma.lead.findMany({ where: { email: { in: emails } } });
    const leadByEmail = new Map(leads.map((l) => [l.email, l]));

    const updates = events.flatMap(({ email, event: eventType, timestamp }) => {
      const lead = leadByEmail.get(email);
      if (!lead) return [];
      const eventDate = new Date(timestamp * 1000);

      if (eventType === "open") {
        return [prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { in: ["SENT", "PENDING"] } },
          data: { status: "OPENED", openedAt: eventDate },
        })];
      }
      if (eventType === "click") {
        return [prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { not: "BOUNCED" } },
          data: { status: "CLICKED", clickedAt: eventDate },
        })];
      }
      if (eventType === "bounce" || eventType === "blocked") {
        return [prisma.campaignContact.updateMany({
          where: { leadId: lead.id },
          data: { status: "BOUNCED" },
        })];
      }
      return [];
    });

    await Promise.all(updates);
  } catch (err) {
    console.error("SendGrid webhook error:", err);
  }

  // Always return 200 — SendGrid retries on non-200
  return NextResponse.json({ ok: true });
}
