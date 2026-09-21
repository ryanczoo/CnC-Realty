import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess, resolveFileRef } from "@/lib/api-auth";
import { isFileReadOnlyFor } from "@/lib/file-lock";
import { FILE_LOCKED_MESSAGE } from "@/lib/file-messages";

async function assertTaskAccess(taskId: string, agentId: string | null, role: string) {
  const task = await prisma.fileTask.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Not found", status: 404 } as const;

  const ref = resolveFileRef(task);
  if (!ref) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(ref.fileType, ref.fileId, agentId, role);
  if (!file) return { error: "Forbidden", status: 403 } as const;
  if (isFileReadOnlyFor(ref.fileType, file.status, role)) return { error: FILE_LOCKED_MESSAGE, status: 403 } as const;

  return { task };
}

export async function PATCH(req: Request, { params }: { params: { taskId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { done?: boolean; title?: string; dueDate?: string | null; assigneeName?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
  }

  const check = await assertTaskAccess(params.taskId, session.user.agentId, session.user.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

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

  const check = await assertTaskAccess(params.taskId, session.user.agentId, session.user.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  await prisma.fileTask.delete({ where: { id: params.taskId } });
  return NextResponse.json({ ok: true });
}
