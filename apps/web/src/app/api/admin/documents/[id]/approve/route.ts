import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReadyToClose } from "@/lib/transaction-helpers";
import { sendAllDocsApproved } from "@/lib/email/transaction-emails";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileDocument.update({
    where: { id: params.id },
    data: { reviewStatus: "APPROVED", reviewedByAdminId: session.user.id, reviewedAt: new Date() },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: doc.fileType,
      listingFileId: doc.listingFileId,
      transactionFileId: doc.transactionFileId,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "DOCUMENT_APPROVED",
      payload: { documentId: doc.id, name: doc.name },
    },
  });

  const fileId = doc.listingFileId ?? doc.transactionFileId!;
  const isListing = doc.fileType === "LISTING";

  const checklistItems = await prisma.fileChecklistItem.findMany({
    where: isListing ? { listingFileId: fileId } : { transactionFileId: fileId },
    include: { documents: true },
  });

  if (isReadyToClose(checklistItems)) {
    const fileRecord = isListing
      ? await prisma.listingFile.findUnique({ where: { id: fileId }, select: { propertyAddress: true, agent: { select: { user: { select: { email: true, name: true } } } } } })
      : await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { propertyAddress: true, agent: { select: { user: { select: { email: true, name: true } } } } } });

    if (fileRecord?.agent?.user) {
      await sendAllDocsApproved({
        agentEmail: fileRecord.agent.user.email,
        agentName: fileRecord.agent.user.name ?? "Agent",
        address: fileRecord.propertyAddress,
        fileType: isListing ? "listing" : "transaction",
        fileId,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
