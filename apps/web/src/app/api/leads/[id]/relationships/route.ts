import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const schema = z.object({
  toLeadId: z.string().min(1),
  type: z.enum(["SPOUSE","PARTNER","FAMILY","REFERRAL"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { toLeadId, type } = schema.parse(await req.json());
    if (toLeadId === params.id) {
      return NextResponse.json({ error: "Cannot link a lead to itself" }, { status: 400 });
    }
    const rel = await prisma.leadRelationship.upsert({
      where: { fromLeadId_toLeadId: { fromLeadId: params.id, toLeadId } },
      update: { type },
      create: { fromLeadId: params.id, toLeadId, type },
    });
    return NextResponse.json(rel, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
