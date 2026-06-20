import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "HOT_PROSPECT", "NURTURE",
  "SHOWING", "OFFER", "UNDER_CONTRACT", "CLOSED", "LOST", "SPHERE",
] as const;

const VALID_ACTION_TYPES = ["ENROLL_PLAN", "SEND_EMAIL"] as const;

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const triggers = await prisma.trigger.findMany({
    orderBy: { createdAt: "asc" },
    include: { actionPlan: { select: { name: true } } },
  });

  return NextResponse.json(
    triggers.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))
  );
}

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { name, statusTrigger, actionType, actionPlanId, emailSubject, emailBody } =
    body as {
      name?: string;
      statusTrigger?: string;
      actionType?: string;
      actionPlanId?: string;
      emailSubject?: string;
      emailBody?: string;
    };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!statusTrigger || !VALID_STATUSES.includes(statusTrigger as any)) {
    return NextResponse.json({ error: "valid statusTrigger is required" }, { status: 400 });
  }
  if (!actionType || !VALID_ACTION_TYPES.includes(actionType as any)) {
    return NextResponse.json({ error: "actionType must be ENROLL_PLAN or SEND_EMAIL" }, { status: 400 });
  }
  if (actionType === "ENROLL_PLAN" && !actionPlanId) {
    return NextResponse.json({ error: "actionPlanId is required for ENROLL_PLAN" }, { status: 400 });
  }
  if (actionType === "SEND_EMAIL" && !emailSubject?.trim()) {
    return NextResponse.json({ error: "emailSubject is required for SEND_EMAIL" }, { status: 400 });
  }
  if (actionType === "SEND_EMAIL" && !emailBody?.trim()) {
    return NextResponse.json({ error: "emailBody is required for SEND_EMAIL" }, { status: 400 });
  }

  if (actionPlanId) {
    const plan = await prisma.actionPlan.findUnique({ where: { id: actionPlanId } });
    if (!plan) {
      return NextResponse.json({ error: "Action plan not found" }, { status: 404 });
    }
  }

  const trigger = await prisma.trigger.create({
    data: {
      name: name.trim(),
      statusTrigger: statusTrigger as any,
      actionType: actionType as any,
      actionPlanId: actionType === "ENROLL_PLAN" ? actionPlanId : null,
      emailSubject: actionType === "SEND_EMAIL" ? emailSubject!.trim() : null,
      emailBody: actionType === "SEND_EMAIL" ? emailBody!.trim() : null,
    },
    include: { actionPlan: { select: { name: true } } },
  });

  return NextResponse.json({ ...trigger, createdAt: trigger.createdAt.toISOString() }, { status: 201 });
}
