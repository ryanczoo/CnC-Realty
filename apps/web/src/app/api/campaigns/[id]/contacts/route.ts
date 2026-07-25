// apps/web/src/app/api/campaigns/[id]/contacts/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const bodySchema = z.object({
  leadIds: z.array(z.string()).min(1, "At least one lead required"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { leadIds } = bodySchema.parse(body);

    await prisma.$transaction(
      leadIds.map((leadId) =>
        prisma.campaignContact.upsert({
          where: { campaignId_leadId: { campaignId: params.id, leadId } },
          create: { campaignId: params.id, leadId, status: "PENDING" },
          update: {},
        })
      )
    );

    return NextResponse.json({ added: leadIds.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
