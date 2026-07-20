import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { name, color } = schema.parse(await req.json());
    const tag = await prisma.tag.upsert({
      where: { name },
      update: color ? { color } : {},
      create: { name, ...(color ? { color } : {}) },
    });
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: params.id, tagId: tag.id } },
      update: {},
      create: { leadId: params.id, tagId: tag.id },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
