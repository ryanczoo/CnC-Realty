import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { taskId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { done?: boolean; title?: string; dueDate?: string | null; assigneeName?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const task = await prisma.fileTask.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.fileTask.update({
    where: { id: params.taskId },
    data: {
      ...(body.done !== undefined && { done: body.done }),
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
      ...(body.assigneeName !== undefined && { assigneeName: body.assigneeName?.trim() || null }),
    },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: Request, { params }: { params: { taskId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.fileTask.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileTask.delete({ where: { id: params.taskId } });
  return NextResponse.json({ ok: true });
}
