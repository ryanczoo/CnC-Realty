import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { substituteVars, sendActionPlanEmail } from "@/lib/action-plan-email";
import type { Prisma } from "@cnc/database";

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
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
          agent: {
            select: { id: true, displayName: true, phone: true, user: { select: { email: true } } },
          },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  // Each step's send/create + status update is independent of every other
  // step, so run them concurrently instead of one at a time. Every branch
  // still resolves (never rejects) so Promise.all can't short-circuit on
  // the first failure — that would abandon the remaining steps.
  const stepResults = await Promise.all(
    dueSteps.map(async (step): Promise<"processed" | "error"> => {
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
          if (!lead.email) {
            // Skip EMAIL step — no lead email on file
            await prisma.leadPlanStep.update({
              where: { id: step.id },
              data: { status: "SKIPPED", executedAt: now },
            });
            return "processed";
          }
          const subject = substituteVars(step.subject ?? "", vars);
          const body = substituteVars(step.body ?? "", vars);
          await sendActionPlanEmail({
            to: lead.email,
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
        return "processed";
      } catch (e) {
        console.error(`[action-plans-cron] step ${step.id} failed:`, e);
        return "error";
      }
    })
  );

  let processed = 0;
  let errors = 0;
  for (const result of stepResults) {
    if (result === "processed") processed++;
    else errors++;
  }

  // Check for newly-completed enrollments (always run, not just when steps were processed)
  const enrollmentIds = Array.from(new Set(dueSteps.map((s) => s.enrollmentId)));
  const enrollmentWhere: Prisma.LeadPlanEnrollmentWhereInput =
    enrollmentIds.length > 0
      ? { id: { in: enrollmentIds }, status: "ACTIVE" }
      : { status: "ACTIVE" };
  const enrollments = await prisma.leadPlanEnrollment.findMany({
    where: enrollmentWhere,
    include: { steps: { select: { status: true } } },
  });
  const completedEnrollments = enrollments.filter(
    (enr) => enr.steps.length > 0 && enr.steps.every((s) => s.status === "DONE" || s.status === "SKIPPED")
  );
  await Promise.all(
    completedEnrollments.map((enr) =>
      prisma.leadPlanEnrollment.update({
        where: { id: enr.id },
        data: { status: "COMPLETED", completedAt: now },
      })
    )
  );

  return NextResponse.json({ processed, errors });
}
