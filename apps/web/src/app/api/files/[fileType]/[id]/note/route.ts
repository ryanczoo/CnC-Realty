import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess, assertFileEditable } from "@/lib/api-auth";

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.fileType !== "listing" && params.fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }
  const isListing = params.fileType === "listing";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    params.id,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const locked = assertFileEditable(isListing ? "listing" : "transaction", file.status, session.user.role);
  if (locked) return locked;

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "note is required" }, { status: 400 });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "NOTE_ADDED",
      note,
    },
  });

  return NextResponse.json({ ok: true });
}
