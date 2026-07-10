import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { FROM } from "@/lib/email";

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
    if (!session.user.agentId || campaign.agentId !== session.user.agentId) {
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

  const results = await Promise.allSettled(
    campaign.contacts.map(async (contact) => {
      await sgMail.send({
        to: contact.lead.email,
        from: FROM,
        subject: campaign.subject!,
        html: campaign.body!,
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
