import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveFileRef, assertFileEditable } from "@/lib/api-auth";

// "Remove from checklist" (SkySlope-style): takes a document off its checklist
// item without deleting it. The file stays in R2 and in the Documents tab as
// Unattached (B&P §10148 retention); the checklist item goes back to needing a
// document. Agents: only their own In Review uploads (which then drop out of the
// broker's review queue as Not Submitted). Broker: any document, status kept.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = session.user.role === "ADMIN";

  const doc = await prisma.fileDocument.findUnique({
    where: { id: params.id },
    include: { checklistItem: { select: { name: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isAdmin && doc.uploadedByAgentId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!doc.checklistItemId) {
    return NextResponse.json({ error: "This document isn't on a checklist item" }, { status: 400 });
  }
  if (!isAdmin && doc.reviewStatus !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "Only documents still in review can be removed" }, { status: 400 });
  }

  const ref = resolveFileRef(doc);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parent = ref.fileType === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: ref.fileId }, select: { status: true } })
    : await prisma.transactionFile.findUnique({ where: { id: ref.fileId }, select: { status: true } });
  const locked = assertFileEditable(ref.fileType, parent?.status, session.user.role);
  if (locked) return locked;

  await prisma.$transaction([
    prisma.fileDocument.update({
      where: { id: doc.id },
      data: {
        checklistItemId: null,
        ...(doc.reviewStatus === "PENDING_REVIEW" && { reviewStatus: "NOT_SUBMITTED" as const }),
      },
    }),
    prisma.fileActivity.create({
      data: {
        fileType: ref.fileType === "listing" ? "LISTING" : "TRANSACTION",
        listingFileId: ref.fileType === "listing" ? ref.fileId : null,
        transactionFileId: ref.fileType === "transaction" ? ref.fileId : null,
        actorId: session.user.id,
        actorRole: isAdmin ? "ADMIN" : "AGENT",
        type: "DOCUMENT_REMOVED",
        payload: { name: doc.name, documentId: doc.id, checklistItemName: doc.checklistItem?.name ?? null },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
