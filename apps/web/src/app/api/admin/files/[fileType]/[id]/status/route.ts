import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransitionListing, canTransitionTransaction, isReadyToClose } from "@/lib/transaction-helpers";

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const isListing = params.fileType === "listing";

  if (isListing) {
    const file = await prisma.listingFile.findUnique({
      where: { id: params.id },
      include: { checklistItems: { include: { documents: true } } },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canTransitionListing(file.status, status, "ADMIN")) {
      return NextResponse.json({ error: `Cannot transition from ${file.status} to ${status}` }, { status: 400 });
    }
    if (status === "CLOSED" && !isReadyToClose(file.checklistItems)) {
      return NextResponse.json({ error: "Cannot close: not all required documents are approved" }, { status: 400 });
    }
    await prisma.listingFile.update({ where: { id: params.id }, data: { status, awaitingReview: false } });
  } else {
    const file = await prisma.transactionFile.findUnique({
      where: { id: params.id },
      include: { checklistItems: { include: { documents: true } } },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canTransitionTransaction(file.status, status, "ADMIN")) {
      return NextResponse.json({ error: `Cannot transition from ${file.status} to ${status}` }, { status: 400 });
    }
    if (status === "CLOSED" && !isReadyToClose(file.checklistItems)) {
      return NextResponse.json({ error: "Cannot close: not all required documents are approved" }, { status: 400 });
    }
    await prisma.transactionFile.update({ where: { id: params.id }, data: { status, awaitingReview: false } });
  }

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "STATUS_CHANGED",
      payload: { to: status },
    },
  });

  return NextResponse.json({ ok: true });
}
