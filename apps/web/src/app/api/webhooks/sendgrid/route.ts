import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "./verify";

interface SendGridEvent {
  email: string;
  event: string;
  timestamp: number;
  [key: string]: unknown;
}

const SENDGRID_PUBLIC_KEY = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ?? "";

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (SENDGRID_PUBLIC_KEY) {
    const signature = req.headers.get("X-Twilio-Email-Event-Webhook-Signature") ?? "";
    const timestamp = req.headers.get("X-Twilio-Email-Event-Webhook-Timestamp") ?? "";
    if (!verifyWebhookSignature(SENDGRID_PUBLIC_KEY, rawBody, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  try {
    const events: SendGridEvent[] = JSON.parse(rawBody);

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
    return NextResponse.json({ processed: updates.length });
  } catch (err) {
    console.error("SendGrid webhook error:", err);
    // Return 200 so SendGrid does not retry — a 5xx would trigger repeated delivery
    // of the same payload and flood the queue on persistent errors.
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}
