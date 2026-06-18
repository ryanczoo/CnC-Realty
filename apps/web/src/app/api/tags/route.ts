import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  const tags = await prisma.tag.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}
