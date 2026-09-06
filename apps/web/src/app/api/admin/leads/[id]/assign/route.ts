import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { emailLayout, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { agentId } = body as { agentId?: string };

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      displayName: true,
      user: { select: { email: true } },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let lead;
  try {
    lead = await prisma.lead.update({
      where: { id: params.id },
      data: {
        agentId,
        brokerageFed: true,
        assignmentSeenAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        source: true,
        createdAt: true,
        agentId: true,
        brokerageFed: true,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    throw e;
  }

  try {
    if (process.env.POSTMARK_SERVER_TOKEN && agent.user.email) {
      const agentDisplayName = agent.displayName ?? "there";
      const firstName = agentDisplayName.trim().split(/\s+/)[0] || agentDisplayName;
      const safeFirstName = escapeHtml(firstName);
      const bodyHtml = `
        <div style="margin: 0 0 32px;">
          <img src="${process.env.NEXTAUTH_URL}/lead-assignment-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />
        </div>
        <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
          Hi ${safeFirstName}, You Just Got A Lead!
        </h2>
        <div style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left;">
          <p style="margin: 0 0 14px;"><strong style="font-weight: 700;">Name:</strong> ${escapeHtml(`${lead.firstName} ${lead.lastName}`)}</p>
          <p style="margin: 0 0 14px;"><strong style="font-weight: 700;">Email:</strong> ${escapeHtml(lead.email)}</p>
          <p style="margin: 0 0 14px;"><strong style="font-weight: 700;">Phone:</strong> ${lead.phone ? escapeHtml(lead.phone) : "Not provided"}</p>
          <p style="margin: 0;"><strong style="font-weight: 700;">Status:</strong> ${escapeHtml(lead.status)}</p>
        </div>
      `;
      const html = emailLayout({
        heading: "",
        bodyHtml,
        ctaLabel: "View Dashboard",
        ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/leads`,
      });
      await sendEmail({
        to: agent.user.email,
        subject: `New Lead - ${lead.firstName} ${lead.lastName}`,
        html,
        stream: "transactional",
      });
    }
  } catch (e) {
    console.error("[lead-pool] assignment email failed:", e);
  }

  return NextResponse.json({ ...lead, createdAt: lead.createdAt.toISOString() });
}
