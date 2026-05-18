import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { mlsNumber: string } }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  await prisma.savedProperty.deleteMany({
    where: { userId: session.user.id, mlsNumber: params.mlsNumber },
  });

  return NextResponse.json({ ok: true });
}
