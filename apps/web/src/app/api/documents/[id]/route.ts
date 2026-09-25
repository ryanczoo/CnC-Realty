import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";
import { resolveFileRef } from "@/lib/api-auth";

// Permanent delete: broker only, for a document that never belonged in the file
// (e.g. another client's paperwork). Everything else uses Remove, which keeps
// the document (B&P §10148). The name and reason are logged on the file first,
// so the record survives even though the document is erased.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  const ref = resolveFileRef(doc);
  if (ref) {
    await prisma.fileActivity.create({
      data: {
        fileType: ref.fileType === "listing" ? "LISTING" : "TRANSACTION",
        listingFileId: ref.fileType === "listing" ? ref.fileId : null,
        transactionFileId: ref.fileType === "transaction" ? ref.fileId : null,
        actorId: session.user.id,
        actorRole: "ADMIN",
        type: "DOCUMENT_DELETED",
        payload: { name: doc.name, documentId: doc.id, reason },
      },
    });
  }

  await deleteR2Object(doc.r2Key);
  await prisma.fileDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
