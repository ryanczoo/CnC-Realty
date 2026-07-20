import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const txFile = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  const { exists, forbidden } = checkOwnership(txFile, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const txFile = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  const { exists, forbidden } = checkOwnership(txFile, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
