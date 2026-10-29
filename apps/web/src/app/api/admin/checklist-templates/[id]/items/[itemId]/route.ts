import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { builtBeforeError, parseBuiltBefore } from "@/lib/year-built";

export async function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const yearError = body.builtBefore !== undefined ? builtBeforeError(body.builtBefore) : null;
  if (yearError) return NextResponse.json({ error: yearError }, { status: 400 });
  if (body.skipWhenConverted !== undefined && typeof body.skipWhenConverted !== "boolean") {
    return NextResponse.json({ error: "skipWhenConverted must be true or false" }, { status: 400 });
  }
  const item = await prisma.checklistTemplateItem.update({
    where: { id: params.itemId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.isRequired !== undefined && { isRequired: body.isRequired }),
      ...(body.builtBefore !== undefined && { builtBefore: parseBuiltBefore(body.builtBefore) }),
      ...(body.skipWhenConverted !== undefined && { skipWhenConverted: body.skipWhenConverted }),
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.checklistTemplateItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ ok: true });
}
