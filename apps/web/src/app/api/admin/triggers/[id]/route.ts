import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { name, statusTrigger, actionType, actionPlanId, emailSubject, emailBody, isActive } =
    body as {
      name?: string;
      statusTrigger?: string;
      actionType?: string;
      actionPlanId?: string | null;
      emailSubject?: string | null;
      emailBody?: string | null;
      isActive?: boolean;
    };

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (statusTrigger !== undefined) data.statusTrigger = statusTrigger;
  if (actionType !== undefined) data.actionType = actionType;
  if (actionPlanId !== undefined) data.actionPlanId = actionPlanId;
  if (emailSubject !== undefined) data.emailSubject = emailSubject;
  if (emailBody !== undefined) data.emailBody = emailBody;
  if (isActive !== undefined) data.isActive = isActive;

  try {
    const trigger = await prisma.trigger.update({
      where: { id: params.id },
      data,
      include: { actionPlan: { select: { name: true } } },
    });
    return NextResponse.json({ ...trigger, createdAt: trigger.createdAt.toISOString() });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    await prisma.trigger.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    throw e;
  }
}
