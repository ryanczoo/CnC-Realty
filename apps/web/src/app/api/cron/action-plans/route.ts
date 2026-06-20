import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { substituteVars, sendActionPlanEmail } from "@/lib/action-plan-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueSteps = await prisma.leadPlanStep.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now },
      enrollment: { status: "ACTIVE" },
    },
    include: {
      enrollment: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
          agent: {
            select: { id: true, displayName: true, phone: true, user: { select: { email: true } } },
          },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  let processed = 0;
  let errors = 0;

  for (const step of dueSteps) {
    try {
      const { enrollment } = step;
      const { lead, agent } = enrollment;
      const vars = {
        firstName: lead.firstName ?? "",
        lastName: lead.lastName ?? "",
        agentName: agent.displayName ?? agent.user?.email ?? "",
        agentPhone: agent.phone ?? "",
      };

      if (step.stepType === "EMAIL") {
        const subject = substituteVars(step.subject ?? "", vars);
        const body = substituteVars(step.body ?? "", vars);
        await sendActionPlanEmail({
          to: agent.user?.email ?? "",
          subject,
          body,
          enrollmentId: enrollment.id,
        });
      } else if (step.stepType === "TASK") {
        const title = substituteVars(step.taskTitle ?? "", vars);
        await prisma.leadTask.create({
          data: {
            leadId: lead.id,
            title,
            taskType: "FOLLOW_UP",
            dueDate: step.dueAt,
          },
        });
      }

      await prisma.leadPlanStep.update({
        where: { id: step.id },
        data: { status: "DONE", executedAt: now },
      });
      processed++;
    } catch (e) {
      console.error(`[action-plans-cron] step ${step.id} failed:`, e);
      errors++;
    }
  }

  // Check for newly-completed enrollments (always run, not just when steps were processed)
  const enrollmentIds = [...new Set(dueSteps.map((s) => s.enrollmentId))];
  const enrollmentWhere =
    enrollmentIds.length > 0
      ? { id: { in: enrollmentIds }, status: "ACTIVE" }
      : { status: "ACTIVE" };
  const enrollments = await prisma.leadPlanEnrollment.findMany({
    where: enrollmentWhere,
    include: { steps: { select: { status: true } } },
  });
  for (const enr of enrollments) {
    const allDone = enr.steps.every((s) => s.status === "DONE" || s.status === "SKIPPED");
    if (allDone && enr.steps.length > 0) {
      await prisma.leadPlanEnrollment.update({
        where: { id: enr.id },
        data: { status: "COMPLETED", completedAt: now },
      });
    }
  }

  return NextResponse.json({ processed, errors });
}
