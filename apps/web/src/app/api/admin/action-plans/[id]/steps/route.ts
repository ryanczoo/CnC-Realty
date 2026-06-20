import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  stepType: z.enum(["EMAIL", "TASK"]),
  subject: z.string().optional(),
  body: z.string().optional(),
  taskTitle: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const plan = await prisma.actionPlan.findUnique({ where: { id: params.id } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    const raw = stepSchema.parse(await req.json());
    if (raw.stepType === "EMAIL" && (!raw.subject || !raw.body)) {
      return NextResponse.json({ error: "EMAIL steps require subject and body" }, { status: 400 });
    }
    if (raw.stepType === "TASK" && !raw.taskTitle) {
      return NextResponse.json({ error: "TASK steps require taskTitle" }, { status: 400 });
    }
    const step = await prisma.actionPlanStep.create({
      data: { planId: params.id, ...raw },
    });
    return NextResponse.json(step, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
