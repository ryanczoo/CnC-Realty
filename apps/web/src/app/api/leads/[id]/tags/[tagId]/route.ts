import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  if (session.user.role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
    if (!agent || !lead || lead.agentId !== agent.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  await prisma.leadTag.deleteMany({ where: { leadId: params.id, tagId: params.tagId } });
  return new NextResponse(null, { status: 204 });
}
