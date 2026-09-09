import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Role = "BUYER" | "AGENT" | "ADMIN";

interface AuthedSession {
  user: { id: string; email: string; name?: string | null; role: Role; agentId: string | null };
}

export async function requireAuth(minRole?: "AGENT" | "ADMIN"): Promise<
  | { session: AuthedSession; error: null }
  | { session: null; error: NextResponse }
> {
  const raw = await getServerSession(authOptions);
  if (!raw?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = raw as unknown as AuthedSession;
  const role = session.user.role;

  if (minRole === "AGENT" && role !== "AGENT" && role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (minRole === "ADMIN" && role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, error: null };
}

export function checkOwnership<T extends { agentId: string | null }>(
  record: T | null,
  callerAgentId: string | null,
  role: string
): { exists: boolean; forbidden: boolean; record: T | null } {
  if (!record) return { exists: false, forbidden: false, record: null };
  if (role === "ADMIN") return { exists: true, forbidden: false, record };
  return { exists: true, forbidden: !callerAgentId || record.agentId !== callerAgentId, record };
}

// Resolves which file (listing or transaction) a record with both possible
// FK columns belongs to, from whichever one is actually populated. Returns
// null if neither is set (shouldn't happen with real data, but callers must
// still handle it — matches the existing 404 behavior at every call site
// this replaces).
// Resolves which file (listing or transaction) a record with both possible
// FK columns belongs to, from whichever one is actually populated. Returns
// null if neither is set (shouldn't happen with real data, but callers must
// still handle it — matches the existing 404 behavior at every call site
// this replaces).
export function resolveFileRef(
  record: { listingFileId: string | null; transactionFileId: string | null }
): { fileId: string; fileType: "listing" | "transaction" } | null {
  const fileId = record.listingFileId ?? record.transactionFileId;
  if (!fileId) return null;
  const fileType: "listing" | "transaction" = record.listingFileId ? "listing" : "transaction";
  return { fileId, fileType };
}

// Resolves a ListingFile or TransactionFile by id and verifies the caller
// owns it (or is ADMIN), in one call. Shared by every route that receives a
// fileType/fileId pair and needs to gate access to the parent file before
// touching a child record (parties, tasks, notes, documents).
export async function getFileAndVerifyAccess(
  fileType: "listing" | "transaction",
  fileId: string,
  callerAgentId: string | null,
  role: string
): Promise<{ id: string; agentId: string } | null> {
  const file = fileType === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, select: { id: true, agentId: true } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { id: true, agentId: true } });
  const { exists, forbidden, record } = checkOwnership(file, callerAgentId, role);
  if (!exists || forbidden) return null;
  return record;
}
