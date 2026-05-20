import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDocumentRejected } from "@/lib/email/transaction-emails";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "Rejection note is required" }, { status: 400 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileDocument.update({
    where: { id: params.id },
    data: { reviewStatus: "REJECTED", rejectionNote: note, reviewedByAdminId: session.user.id, reviewedAt: new Date() },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: doc.fileType,
      listingFileId: doc.listingFileId,
      transactionFileId: doc.transactionFileId,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "DOCUMENT_REJECTED",
      payload: { documentId: doc.id, name: doc.name, note },
    },
  });

  const fileId = doc.listingFileId ?? doc.transactionFileId!;
  const isListing = doc.fileType === "LISTING";
  const fileRecord = isListing
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, select: { propertyAddress: true, agent: { select: { user: { select: { email: true, name: true } } } } } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { propertyAddress: true, agent: { select: { user: { select: { email: true, name: true } } } } } });

  if (fileRecord?.agent?.user) {
    await sendDocumentRejected({
      agentEmail: fileRecord.agent.user.email,
      agentName: fileRecord.agent.user.name ?? "Agent",
      documentName: doc.name,
      address: fileRecord.propertyAddress,
      rejectionNote: note,
      fileType: isListing ? "listing" : "transaction",
      fileId,
    });
  }

  return NextResponse.json({ ok: true });
}
