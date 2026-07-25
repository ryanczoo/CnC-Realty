import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadTag.deleteMany({ where: { leadId: params.id, tagId: params.tagId } });
  return new NextResponse(null, { status: 204 });
}
