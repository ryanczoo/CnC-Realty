import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    // Ownership check is enforced by the where clause — delete will throw if not found/owned
    await prisma.savedSearch.delete({
      where: { id, userId: session.user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Prisma P2025 = record not found
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found or not owned by user" }, { status: 404 });
    }
    console.error("[saved-searches DELETE] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
