import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

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

  const lead = await prisma.lead.update({
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

  try {
    if (process.env.SENDGRID_API_KEY && agent.user.email) {
      await sgMail.send({
        to: agent.user.email,
        from: FROM,
        subject: `New lead assigned to you — ${lead.firstName} ${lead.lastName}`,
        text: [
          `Hi ${agent.displayName ?? "there"},`,
          "",
          "Ryan has assigned you a new brokerage lead:",
          "",
          `Name: ${lead.firstName} ${lead.lastName}`,
          `Email: ${lead.email}`,
          `Phone: ${lead.phone ?? "Not provided"}`,
          `Status: ${lead.status}`,
          "",
          "Log in to view their full profile and get started.",
          "",
          "— CnC Realty Group",
        ].join("\n"),
      });
    }
  } catch (e) {
    console.error("[lead-pool] assignment email failed:", e);
  }

  return NextResponse.json({ ...lead, createdAt: lead.createdAt.toISOString() });
}
