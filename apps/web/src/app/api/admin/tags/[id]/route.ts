import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const data = patchSchema.parse(await req.json());
    const tag = await prisma.tag.update({ where: { id: params.id }, data });
    return NextResponse.json(tag);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    if ((err as any)?.code === "P2025") return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  const count = await prisma.leadTag.count({ where: { tagId: params.id } });
  if (count > 0 && !force) {
    return NextResponse.json({ error: `Used by ${count} leads`, count }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.leadTag.deleteMany({ where: { tagId: params.id } }),
    prisma.tag.delete({ where: { id: params.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
