import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeFileStatus } from "@/lib/file-status";

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const result = await changeFileStatus({
    kind: params.fileType === "listing" ? "listing" : "transaction",
    fileId: params.id,
    toStatus: status,
    actor: { userId: session.user.id, role: "ADMIN" },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, ...(result.emailWarning && { emailWarning: true }) });
}
