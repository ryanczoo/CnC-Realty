import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";

  const doc = await prisma.fileDocument.create({
    data: {
      id: documentId ?? undefined,
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      checklistItemId: checklistItemId ?? null,
      name,
      r2Key,
      r2Url,
      uploadedByAgentId: session.user.id,
      reviewStatus: "PENDING_REVIEW",
    },
  });

  await prisma.fileActivity.create({
    data: {
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "DOCUMENT_UPLOADED",
      payload: { documentId: doc.id, name },
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
