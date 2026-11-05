import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess, assertFileEditable, actingRole } from "@/lib/api-auth";
import { trimStrings } from "@/lib/form-validation";
import { maybeAutoPending } from "@/lib/file-status";

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.fileType !== "listing" && params.fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }
  const isListing = params.fileType === "listing";
  // An admin in the Agent section sends the agent-view marker and is treated as an agent.
  const actor = actingRole(session.user.role, req) === "ADMIN" ? "ADMIN" : "AGENT";
  const file = await getFileAndVerifyAccess(isListing ? "listing" : "transaction", params.id, session.user.agentId, actor);
  if (!file) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  const locked = assertFileEditable(isListing ? "listing" : "transaction", file.status, actor);
  if (locked) return locked;

  const body = trimStrings(await req.json());
  const { role, name, email, phone, company, licenseNumber } = body;
  if (!role || !name) return NextResponse.json({ error: "role and name are required" }, { status: 400 });

  const party = await prisma.fileParty.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      role, name,
      email: email ?? null,
      phone: phone ?? null,
      company: company ?? null,
      licenseNumber: licenseNumber ?? null,
    },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: actor,
      type: "PARTY_ADDED",
      payload: { partyId: party.id, role, name },
    },
  });

  // A new party may be the last detail a transaction needed to become Pending.
  if (!isListing) await maybeAutoPending(params.id, { userId: session.user.id, role: actor });

  return NextResponse.json({ party }, { status: 201 });
}
