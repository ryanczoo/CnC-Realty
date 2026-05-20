import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: agent.userId },
      data: { role: "ADMIN" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Promote agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
