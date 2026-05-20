import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.reviewStatus !== "PENDING_REVIEW" && doc.reviewStatus !== "NOT_SUBMITTED") {
    return NextResponse.json({ error: "Cannot delete a reviewed document" }, { status: 400 });
  }
  if (doc.uploadedByAgentId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteR2Object(doc.r2Key);
  await prisma.fileDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
