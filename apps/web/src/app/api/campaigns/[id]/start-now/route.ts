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
    // Clamped to non-positive: if the earliest delivery is already overdue
    // (e.g. was held back by quota exhaustion while the campaign stayed
    // SCHEDULED), a positive delta would push every pending delivery
    // further into the future — the opposite of "start now."
    const delta = Math.min(0, Date.now() - earliestDueAt);

    // Grouped by distinct dueAt rather than one update per row: there are at
    // most as many distinct values as there are drip steps, typically far
    // fewer than the number of pending recipient rows.
    const byDueAt = new Map<number, Date>();
    for (const d of pending) {
      byDueAt.set(d.dueAt.getTime(), d.dueAt);
    }
    await Promise.all(
      Array.from(byDueAt.entries()).map(([time, originalDueAt]) =>
        prisma.campaignDelivery.updateMany({
          where: { status: "PENDING", campaignContact: { campaignId: params.id }, dueAt: originalDueAt },
          data: { dueAt: new Date(time + delta) },
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
