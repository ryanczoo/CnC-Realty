import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;

const schema = z.object({
  title: z.string().min(1),
  taskType: z.enum(TASK_TYPES).default("FOLLOW_UP"),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = schema.parse(await req.json());
    const task = await prisma.leadTask.create({
      data: {
        leadId: params.id,
        title: body.title,
        taskType: body.taskType,
        assigneeId: body.assigneeId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
