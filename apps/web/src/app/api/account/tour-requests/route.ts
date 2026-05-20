import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const requests = await prisma.lead.findMany({
    where: { email: session.user.email },
    orderBy: { createdAt: "desc" },
    select: { id: true, notes: true, status: true, createdAt: true },
  });

  return NextResponse.json({ requests });
}
