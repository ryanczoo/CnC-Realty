import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // params.id is the Agent id — look up the linked user
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
