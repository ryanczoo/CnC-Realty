import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

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
