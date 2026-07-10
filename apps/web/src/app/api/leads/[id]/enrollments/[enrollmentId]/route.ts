import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function assertOwnership(leadId: string, agentId: string | null, role: string) {
  if (role === "ADMIN") return true;
  if (!agentId) return false;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return !!lead && lead.agentId === agentId;
}

export async function PATCH(req: Request, { params }: { params: { id: string; enrollmentId: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.agentId, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = await prisma.leadPlanEnrollment.findUnique({ where: { id: params.enrollmentId } });
  if (!enrollment || enrollment.leadId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schema = z.object({ status: z.enum(["PAUSED", "ACTIVE", "CANCELLED"]) });
  let status: "PAUSED" | "ACTIVE" | "CANCELLED";
  try {
    ({ status } = schema.parse(await req.json()));
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    let enrData: Record<string, unknown> = { status };
    if (status === "PAUSED") {
      enrData = { ...enrData, pausedAt: new Date(), pausedReason: "MANUAL" };
      await tx.leadPlanStep.updateMany({
        where: { enrollmentId: params.enrollmentId, status: "PENDING" },
        data: { status: "PAUSED" },
      });
    } else if (status === "ACTIVE") {
      enrData = { ...enrData, pausedAt: null, pausedReason: null };
      await tx.leadPlanStep.updateMany({
        where: { enrollmentId: params.enrollmentId, status: "PAUSED" },
        data: { status: "PENDING" },
      });
    } else if (status === "CANCELLED") {
      await tx.leadPlanStep.updateMany({
        where: { enrollmentId: params.enrollmentId, status: { in: ["PENDING", "PAUSED"] } },
        data: { status: "SKIPPED" },
      });
    }
    return tx.leadPlanEnrollment.update({ where: { id: params.enrollmentId }, data: enrData });
  });

  return NextResponse.json(updated);
}
