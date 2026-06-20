import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = [
  "NEW","CONTACTED","QUALIFIED","HOT_PROSPECT","NURTURE",
  "SHOWING","OFFER","UNDER_CONTRACT","CLOSED","LOST","SPHERE",
] as const;

const patchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
  priceMin: z.number().nullable().optional(),
  priceMax: z.number().nullable().optional(),
  timeframeToMove: z.string().nullable().optional(),
});

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const [agent, lead] = await Promise.all([
    prisma.agent.findUnique({ where: { userId } }),
    prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } }),
  ]);
  return agent && lead && lead.agentId === agent.id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      tags: { include: { tag: true } },
      tasks: { orderBy: { createdAt: "asc" } },
      relationshipsFrom: { include: { toLead: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      relationshipsTo:   { include: { fromLead: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      agent: { include: { user: { select: { name: true } } } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data: z.infer<typeof patchSchema>;
  let lead: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string; agentId: string | null; createdAt: Date; updatedAt: Date };
  try {
    const body = await req.json();
    data = patchSchema.parse(body);
    lead = await prisma.lead.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        agentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Fire triggers for status changes — non-fatal, never blocks the response
  if (data.status) {
    try {
      const triggers = await prisma.trigger.findMany({
        where: { statusTrigger: data.status as any, isActive: true },
        include: {
          actionPlan: {
            include: { steps: { orderBy: { stepOrder: "asc" } } },
          },
        },
      });

      for (const trigger of triggers) {
        // Once-per-lead: unique constraint on (triggerId, leadId)
        try {
          await prisma.triggerExecution.create({
            data: { triggerId: trigger.id, leadId: params.id },
          });
        } catch (e: any) {
          if (e?.code === "P2002") continue; // already fired for this lead
          throw e;
        }

        if (trigger.actionType === "ENROLL_PLAN" && trigger.actionPlan) {
          const plan = trigger.actionPlan;
          if (!plan.isActive) continue;

          const existing = await prisma.leadPlanEnrollment.findFirst({
            where: { leadId: params.id, planId: plan.id, status: "ACTIVE" },
          });
          if (existing) continue;

          if (!lead.agentId) continue; // no agent to attribute enrollment to

          const now = new Date();
          await prisma.$transaction(async (tx) => {
            const enr = await tx.leadPlanEnrollment.create({
              data: { leadId: params.id, planId: plan.id, agentId: lead.agentId! },
            });
            if (plan.steps.length > 0) {
              await tx.leadPlanStep.createMany({
                data: plan.steps.map((s) => {
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
          });
        }

        if (trigger.actionType === "SEND_EMAIL" && trigger.emailSubject && trigger.emailBody) {
          try {
            if (process.env.SENDGRID_API_KEY && lead.email) {
              sgMail.setApiKey(process.env.SENDGRID_API_KEY);
              await sgMail.send({
                to: lead.email,
                from: FROM,
                subject: trigger.emailSubject,
                text: trigger.emailBody,
              });
            }
          } catch (e) {
            console.error("[triggers] email send failed:", e);
          }
        }
      }
    } catch (e) {
      console.error("[triggers] execution failed:", e);
    }
  }

  return NextResponse.json(lead);
}
