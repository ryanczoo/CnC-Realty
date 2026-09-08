import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";
import { buildR2Key } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    fileId,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // r2Key/r2Url come from the client — verify the key actually belongs to
  // THIS file (buildR2Key's format is deterministic: every key legitimately
  // issued by /api/upload-url for this exact file starts with this prefix),
  // so a caller can't register a document pointing at another file's real
  // R2 object just because they own *some* file to attach it to. The prefix
  // is derived from buildR2Key itself (rather than duplicating its template)
  // so the two can never drift out of sync.
  const placeholderKey = buildR2Key(isListing ? "listing" : "transaction", fileId, "__doc__", "__name__");
  const expectedPrefix = placeholderKey.slice(0, placeholderKey.indexOf("__doc__"));
  if (!r2Key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid document key" }, { status: 400 });
  }

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
