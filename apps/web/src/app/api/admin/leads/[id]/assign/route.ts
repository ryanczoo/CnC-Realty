import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import sgMail from "@sendgrid/mail";
import { FROM, emailLayout, escapeHtml } from "@/lib/email";

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
    if (process.env.SENDGRID_API_KEY && agent.user.email) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const safeAgentName = escapeHtml(agent.displayName ?? "there");
      const bodyHtml = `
        <div style="color: #4b4b4b; font-size: 15px; line-height: 1.8; text-align: left;">
          <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Name:</strong> ${escapeHtml(`${lead.firstName} ${lead.lastName}`)}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Email:</strong> ${escapeHtml(lead.email)}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Phone:</strong> ${lead.phone ? escapeHtml(lead.phone) : "Not provided"}</p>
          <p style="margin: 0;"><strong style="color: #1B1B1B;">Status:</strong> ${escapeHtml(lead.status)}</p>
        </div>
      `;
      await sgMail.send({
        to: agent.user.email,
        from: FROM,
        subject: `New lead assigned to you — ${lead.firstName} ${lead.lastName}`,
        html: emailLayout({
          heading: `Hi ${safeAgentName}, you have a new lead`,
          bodyHtml,
          ctaLabel: "View Dashboard",
          ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/leads`,
        }),
      });
    }
  } catch (e) {
    console.error("[lead-pool] assignment email failed:", e);
  }

  return NextResponse.json({ ...lead, createdAt: lead.createdAt.toISOString() });
}
