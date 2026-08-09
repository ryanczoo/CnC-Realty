import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";
import { emailLayout } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

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
        include: { lead: { select: { email: true, firstName: true, lastName: true } } },
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

  let sent = 0;
  let errors = 0;
  const now = new Date();
  const html = emailLayout({ heading: campaign.subject!, bodyHtml: campaign.body! });

  const results = await Promise.allSettled(
    campaign.contacts.map(async (contact) => {
      await sendEmail({
        to: contact.lead.email,
        subject: campaign.subject!,
        html,
        stream: "broadcast",
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
