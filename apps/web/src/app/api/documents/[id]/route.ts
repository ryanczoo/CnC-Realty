import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";
import { resolveFileRef, assertFileEditable } from "@/lib/api-auth";

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

  const ref = resolveFileRef(doc);
  if (ref) {
    const parent = ref.fileType === "listing"
      ? await prisma.listingFile.findUnique({ where: { id: ref.fileId }, select: { status: true } })
      : await prisma.transactionFile.findUnique({ where: { id: ref.fileId }, select: { status: true } });
    const locked = assertFileEditable(ref.fileType, parent?.status, session.user.role);
    if (locked) return locked;
  }

  await deleteR2Object(doc.r2Key);
  await prisma.fileDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
