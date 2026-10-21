import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess, assertFileEditable } from "@/lib/api-auth";
import { buildR2Key } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId, replacesDocumentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (fileType !== "LISTING" && fileType !== "TRANSACTION") {
    return NextResponse.json({ error: "fileType must be 'LISTING' or 'TRANSACTION'" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    fileId,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const locked = assertFileEditable(isListing ? "listing" : "transaction", file.status, session.user.role);
  if (locked) return locked;

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

  // "Upload" on a rejected Additional Documents line: the new document takes that
  // line, and the rejected one stays in the file (Documents tab, "Unattached",
  // still Rejected) — the same way a checklist row's newest upload covers its
  // rejected one.
  if (replacesDocumentId) {
    const old = await prisma.fileDocument.findUnique({ where: { id: replacesDocumentId } });
    const sameFile = old && (isListing ? old.listingFileId : old.transactionFileId) === fileId;
    if (!old || !sameFile || !old.isAdditional || old.reviewStatus !== "REJECTED" || checklistItemId) {
      return NextResponse.json({ error: "Only a rejected additional document can be replaced" }, { status: 400 });
    }
  }

  const create = prisma.fileDocument.create({
    data: {
      id: documentId ?? undefined,
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      checklistItemId: checklistItemId ?? null,
      // Added through Additional Documents rather than a checklist item.
      isAdditional: !checklistItemId,
      name,
      r2Key,
      r2Url,
      uploadedByAgentId: session.user.id,
      reviewStatus: "PENDING_REVIEW",
    },
  });
  const [doc] = replacesDocumentId
    ? await prisma.$transaction([create, prisma.fileDocument.update({ where: { id: replacesDocumentId }, data: { isAdditional: false } })])
    : [await create];

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
