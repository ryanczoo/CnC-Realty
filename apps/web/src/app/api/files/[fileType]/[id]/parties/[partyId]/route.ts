import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const party = await prisma.fileParty.findUnique({ where: { id: params.partyId } });
  if (!party) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.fileParty.update({
    where: { id: params.partyId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber }),
    },
  });

  return NextResponse.json({ party: updated });
}

export async function DELETE(_req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.fileParty.delete({ where: { id: params.partyId } });
  return NextResponse.json({ ok: true });
}
