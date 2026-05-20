import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const template = await prisma.checklistTemplate.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.transactionSide !== undefined && { transactionSide: body.transactionSide }),
      ...(body.listingType !== undefined && { listingType: body.listingType }),
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ template });
}
