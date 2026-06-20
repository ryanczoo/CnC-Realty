import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string; stepId: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({
    stepOrder: z.number().int().min(1).optional(),
    delayDays: z.number().int().min(0).optional(),
    stepType: z.enum(["EMAIL", "TASK"]).optional(),
    subject: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    taskTitle: z.string().nullable().optional(),
  });
  try {
    const data = schema.parse(await req.json());
    const step = await prisma.actionPlanStep.update({ where: { id: params.stepId }, data });
    return NextResponse.json(step);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; stepId: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  await prisma.actionPlanStep.delete({ where: { id: params.stepId } });
  return new NextResponse(null, { status: 204 });
}
