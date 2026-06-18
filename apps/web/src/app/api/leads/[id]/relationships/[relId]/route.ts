import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return agent && lead && lead.agentId === agent.id;
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; relId: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadRelationship.deleteMany({
    where: {
      id: params.relId,
      OR: [{ fromLeadId: params.id }, { toLeadId: params.id }],
    },
  });
  return new NextResponse(null, { status: 204 });
}
