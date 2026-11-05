import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess, assertFileEditable, actingRole } from "@/lib/api-auth";
import { trimStrings } from "@/lib/form-validation";

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.fileType !== "listing" && params.fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }
  const isListing = params.fileType === "listing";
  // An admin in the Agent section sends the agent-view marker and is treated as an agent.
  const role = actingRole(session.user.role, req) === "ADMIN" ? "ADMIN" : "AGENT";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    params.id,
    session.user.agentId,
    role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const locked = assertFileEditable(isListing ? "listing" : "transaction", file.status, role);
  if (locked) return locked;

  const { note } = trimStrings(await req.json());
  if (!note?.trim()) return NextResponse.json({ error: "note is required" }, { status: 400 });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: role,
      type: "NOTE_ADDED",
      note,
    },
  });

  return NextResponse.json({ ok: true });
}
