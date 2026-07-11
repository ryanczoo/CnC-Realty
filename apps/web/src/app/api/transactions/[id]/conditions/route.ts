import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

type Params = { params: { id: string } };

async function checkFileAccess(fileId: string, agentId: string | null, role: string) {
  const file = await prisma.transactionFile.findUnique({ where: { id: fileId } });
  if (!file) return { file: null, forbidden: false };
  if (role === "ADMIN") return { file, forbidden: false };
  return { file, forbidden: !agentId || file.agentId !== agentId };
}

export async function GET(_req: Request, { params }: Params) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { file, forbidden } = await checkFileAccess(params.id, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conditions = await prisma.fileCondition.findMany({
    where: { transactionFileId: params.id },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(conditions);
}

export async function POST(req: Request, { params }: Params) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { file, forbidden } = await checkFileAccess(params.id, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const condition = await prisma.fileCondition.create({
    data: {
      transactionFileId: params.id,
      name: body.name,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(condition, { status: 201 });
}
