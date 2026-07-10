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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.agentId, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollments = await prisma.leadPlanEnrollment.findMany({
    where: { leadId: params.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      plan: { select: { name: true } },
      steps: {
        select: { id: true, stepOrder: true, stepType: true, subject: true, taskTitle: true, dueAt: true, status: true, executedAt: true },
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  return NextResponse.json(
    enrollments.map((e) => ({
      id: e.id,
      planId: e.planId,
      planName: e.plan.name,
      agentId: e.agentId,
      status: e.status,
      enrolledAt: e.enrolledAt,
      pausedAt: e.pausedAt,
      pausedReason: e.pausedReason,
      completedAt: e.completedAt,
      steps: e.steps,
    }))
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.agentId, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schema = z.object({ planId: z.string().min(1) });
  let planId: string;
  try {
    ({ planId } = schema.parse(await req.json()));
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const plan = await prisma.actionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const existing = await prisma.leadPlanEnrollment.findFirst({
    where: { leadId: params.id, planId, status: "ACTIVE" },
  });
  if (existing) return NextResponse.json({ error: "Already enrolled in this plan" }, { status: 409 });

  // Enrollment is an agent-only action — requires an agent record on the session
  const agentId = session.user.agentId;
  if (!agentId) return NextResponse.json({ error: "No agent record" }, { status: 403 });

  const templateSteps = await prisma.actionPlanStep.findMany({
    where: { planId },
    orderBy: { stepOrder: "asc" },
  });

  const now = new Date();
  const enrollment = await prisma.$transaction(async (tx) => {
    const enr = await tx.leadPlanEnrollment.create({
      data: { leadId: params.id, planId, agentId },
    });
    if (templateSteps.length > 0) {
      await tx.leadPlanStep.createMany({
        data: templateSteps.map((s) => {
          const dueAt = new Date(now);
          dueAt.setDate(dueAt.getDate() + s.delayDays);
          return {
            enrollmentId: enr.id,
            stepOrder: s.stepOrder,
            stepType: s.stepType,
            subject: s.subject,
            body: s.body,
            taskTitle: s.taskTitle,
            dueAt,
          };
        }),
      });
    }
    return enr;
  });

  const full = await prisma.leadPlanEnrollment.findUnique({
    where: { id: enrollment.id },
    include: {
      plan: { select: { name: true } },
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });
  if (!full) return NextResponse.json({ error: "Server error" }, { status: 500 });
  return NextResponse.json(full, { status: 201 });
}
