import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { ALL_ACTIVITY_TYPES, getDateFilter } from "@/lib/reports";

export const dynamic = "force-dynamic";

const ALL_SOURCES = ["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"] as const;

export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range");
  const dateFilter = getDateFilter(range);

  const [leadsThisPeriod, dealsInPipeline, dealsClosed, activitiesLogged, sourceGroups, activityGroups] =
    await Promise.all([
      prisma.lead.count({
        where: { agentId: agent.id, createdAt: dateFilter as any },
      }),
      prisma.deal.count({
        where: {
          agentId: agent.id,
          createdAt: dateFilter as any,
          stage: { notIn: ["FALLEN_OUT", "OFFER_ACCEPTED"] },
        },
      }),
      prisma.deal.count({
        where: {
          agentId: agent.id,
          stageUpdatedAt: dateFilter as any,
          stage: "OFFER_ACCEPTED",
        },
      }),
      prisma.activity.count({
        where: {
          createdAt: dateFilter as any,
          lead: { agentId: agent.id },
        },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { agentId: agent.id, createdAt: dateFilter as any },
        _count: { id: true },
      }),
      prisma.activity.groupBy({
        by: ["type"],
        where: {
          createdAt: dateFilter as any,
          lead: { agentId: agent.id },
        },
        _count: { id: true },
      }),
    ]);

  // Source breakdown
  const sourceTotal = sourceGroups.reduce((s, g) => s + g._count.id, 0);
  const sourceMap = new Map(sourceGroups.map((g) => [g.source as string, g._count.id]));
  const sourceBreakdown = ALL_SOURCES.map((source) => {
    const count = sourceMap.get(source) ?? 0;
    return {
      source,
      count,
      percent: sourceTotal > 0 ? Math.round((count / sourceTotal) * 1000) / 10 : 0,
    };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // Activity breakdown — all 6 types, zero-fill
  const activityMap = new Map(activityGroups.map((g) => [g.type as string, g._count.id]));
  const activityBreakdown = ALL_ACTIVITY_TYPES.map((type) => ({
    type,
    count: activityMap.get(type) ?? 0,
  }));

  return NextResponse.json({
    summary: { leadsThisPeriod, activitiesLogged, dealsInPipeline, dealsClosed },
    sourceBreakdown,
    activityBreakdown,
  });
}
