import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({ winnerId: z.string(), loserId: z.string() });

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const { winnerId, loserId } = schema.parse(await req.json());
    if (winnerId === loserId) return NextResponse.json({ error: "Cannot merge a lead with itself" }, { status: 400 });

    await prisma.$transaction([
      prisma.activity.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      prisma.leadTag.deleteMany({ where: { leadId: loserId } }),
      prisma.leadTask.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      prisma.leadRelationship.deleteMany({ where: { OR: [{ fromLeadId: loserId }, { toLeadId: loserId }] } }),
      prisma.campaignContact.deleteMany({ where: { leadId: loserId } }),
      prisma.lead.delete({ where: { id: loserId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
