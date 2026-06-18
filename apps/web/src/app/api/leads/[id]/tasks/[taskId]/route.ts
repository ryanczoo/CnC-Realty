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

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return agent && lead && lead.agentId === agent.id;
}

export async function PATCH(req: Request, { params }: { params: { id: string; taskId: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.done === true) data.completedAt = new Date();
    if (body.done === false) data.completedAt = null;

    await prisma.leadTask.updateMany({ where: { id: params.taskId, leadId: params.id }, data: data as any });
    const task = await prisma.leadTask.findFirst({ where: { id: params.taskId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; taskId: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadTask.deleteMany({ where: { id: params.taskId, leadId: params.id } });
  return new NextResponse(null, { status: 204 });
}
