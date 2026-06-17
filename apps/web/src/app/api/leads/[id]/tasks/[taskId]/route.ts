import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  taskType: z.enum(["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  done: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string; taskId: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.done === true) data.completedAt = new Date();
    if (body.done === false) data.completedAt = null;

    const task = await prisma.leadTask.update({ where: { id: params.taskId }, data });
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; taskId: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  await prisma.leadTask.delete({ where: { id: params.taskId } });
  return new NextResponse(null, { status: 204 });
}
