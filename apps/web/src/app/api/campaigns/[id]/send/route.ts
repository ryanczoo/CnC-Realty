// apps/web/src/app/api/campaigns/[id]/send/route.ts
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        where: { status: "PENDING" },
        include: { lead: { select: { email: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership check
  if (session.user.role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    if (!agent || campaign.agentId !== agent.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!campaign.subject || !campaign.body) {
    return NextResponse.json(
      { error: "Campaign must have a subject and body before sending" },
      { status: 400 }
    );
  }

  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json({ error: "SENDGRID_API_KEY not configured" }, { status: 500 });
  }

  let sent = 0;
  let errors = 0;
  const now = new Date();

  for (const contact of campaign.contacts) {
    try {
      await sgMail.send({
        to: contact.lead.email,
        from: "noreply@cncrealtygroup.com",
        subject: campaign.subject,
        html: campaign.body,
      });

      await prisma.campaignContact.update({
        where: { id: contact.id },
        data: { status: "SENT", sentAt: now },
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${contact.lead.email}:`, err);
      errors++;
    }
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: now },
  });

  return NextResponse.json({ sent, errors });
}
