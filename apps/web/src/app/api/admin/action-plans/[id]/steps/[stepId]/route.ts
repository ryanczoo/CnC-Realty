import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function isNotFound(err: unknown): boolean {
  return (err as any)?.code === "P2025";
}

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
    // When changing stepType, re-validate required fields
    if (data.stepType === "EMAIL" && (data.subject === null || data.body === null)) {
      return NextResponse.json({ error: "EMAIL steps require subject and body" }, { status: 400 });
    }
    if (data.stepType === "TASK" && data.taskTitle === null) {
      return NextResponse.json({ error: "TASK steps require taskTitle" }, { status: 400 });
    }
    const step = await prisma.actionPlanStep.update({ where: { id: params.stepId }, data });
    return NextResponse.json(step);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    if (isNotFound(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; stepId: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    await prisma.actionPlanStep.delete({ where: { id: params.stepId } });
  } catch (err) {
    if (isNotFound(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
