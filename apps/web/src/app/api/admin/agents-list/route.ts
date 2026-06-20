import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const agents = await prisma.agent.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      user: { select: { email: true } },
    },
  });

  return NextResponse.json(agents);
}
