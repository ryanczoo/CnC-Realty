import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true, status: true },
  });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (campaign!.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Only a scheduled campaign can be started early" }, { status: 400 });
  }

  const pending = await prisma.campaignDelivery.findMany({
    where: { status: "PENDING", campaignContact: { campaignId: params.id } },
    select: { id: true, dueAt: true },
  });

  if (pending.length > 0) {
    const earliestDueAt = Math.min(...pending.map((d) => d.dueAt.getTime()));
    const delta = Date.now() - earliestDueAt;

    await Promise.all(
      pending.map((d) =>
        prisma.campaignDelivery.update({
          where: { id: d.id },
          data: { dueAt: new Date(d.dueAt.getTime() + delta) },
        })
      )
    );
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
