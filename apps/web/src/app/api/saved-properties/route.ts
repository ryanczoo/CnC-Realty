import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const saved = await prisma.savedProperty.findMany({
    where: { userId: session.user.id },
    select: { mlsNumber: true },
  });

  return NextResponse.json({ mlsNumbers: saved.map((s) => s.mlsNumber) });
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { mlsNumber } = await req.json();
  if (!mlsNumber || typeof mlsNumber !== "string") {
    return NextResponse.json({ error: "mlsNumber required" }, { status: 400 });
  }

  await prisma.savedProperty.upsert({
    where: { userId_mlsNumber: { userId: session.user.id, mlsNumber } },
    create: { userId: session.user.id, mlsNumber },
    update: {},
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
