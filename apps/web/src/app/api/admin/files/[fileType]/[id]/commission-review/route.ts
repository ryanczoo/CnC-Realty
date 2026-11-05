import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveCommissionChange } from "@/lib/commission-review-db";

// The broker approves or rejects a commission change an agent made after approval.
export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (params.fileType !== "listing" && params.fileType !== "transaction") {
    return NextResponse.json({ error: "Unknown file type" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (body.decision === "reject" && !reason) {
    return NextResponse.json({ error: "Please give a reason" }, { status: 400 });
  }

  const result = await resolveCommissionChange(
    params.fileType,
    params.id,
    body.decision === "approve" ? { approve: true } : { approve: false, reason },
    { userId: session.user.id, role: "ADMIN", name: session.user.name ?? null },
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, file: result.file, ...(result.emailWarning && { emailWarning: true }) });
}
