import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  if (!session.user.agentId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 403 });
  }

  const result = await prisma.lead.updateMany({
    where: {
      agentId: session.user.agentId,
      brokerageFed: true,
      assignmentSeenAt: null,
    },
    data: { assignmentSeenAt: new Date() },
  });

  return NextResponse.json({ dismissed: result.count });
}
