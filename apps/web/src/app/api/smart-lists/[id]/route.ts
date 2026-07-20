import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(1).optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
  })).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const existingList = await prisma.smartList.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(existingList, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const list = await prisma.smartList.update({
      where: { id: params.id },
      data: { ...(body.name && { name: body.name }), ...(body.filters && { filters: body.filters }) },
    });
    return NextResponse.json(list);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    if ((err as any)?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const existingList = await prisma.smartList.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(existingList, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.smartList.delete({ where: { id: params.id } }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
