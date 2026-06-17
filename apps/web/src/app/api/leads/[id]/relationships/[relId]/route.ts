import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; relId: string } }
) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  await prisma.leadRelationship.deleteMany({
    where: {
      id: params.relId,
      OR: [{ fromLeadId: params.id }, { toLeadId: params.id }],
    },
  });
  return new NextResponse(null, { status: 204 });
}
