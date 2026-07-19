import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { ALL_ACTIVITY_TYPES, getDateFilter, formatSpeedToLead } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range");
  const dateFilter = getDateFilter(range);

  // 1. Fetch all agents
  const agents = await prisma.agent.findMany({
    select: { id: true, displayName: true },
  });

  // 2. Parallel aggregation queries
  const [leadGroups, activityCountsByLead, pipelineGroups, closedGroups, speedLeads, sourceGroups, activityGroups] =
    await Promise.all([
      // leads owned per agent in range
      prisma.lead.groupBy({
        by: ["agentId"],
        where: { createdAt: dateFilter as any, agentId: { not: null } },
        _count: { id: true },
      }),
      // per-lead activity counts in range (aggregated in Postgres, not in JS)
      prisma.activity.groupBy({
        by: ["leadId"],
        where: { createdAt: dateFilter as any, leadId: { not: null } },
        _count: { id: true },
      }),
      // deals in pipeline per agent
      prisma.deal.groupBy({
        by: ["agentId"],
        where: {
          createdAt: dateFilter as any,
          stage: { notIn: ["FALLEN_OUT", "OFFER_ACCEPTED"] },
        },
        _count: { id: true },
      }),
      // deals closed per agent
      prisma.deal.groupBy({
        by: ["agentId"],
        where: { stageUpdatedAt: dateFilter as any, stage: "OFFER_ACCEPTED" },
        _count: { id: true },
      }),
      // leads with lastContactedAt for speed-to-lead
      prisma.lead.findMany({
        where: {
          createdAt: dateFilter as any,
          lastContactedAt: { not: null },
          agentId: { not: null },
        },
        select: { agentId: true, createdAt: true, lastContactedAt: true },
        take: 2000,
      }),
      // source breakdown (all leads in range)
      prisma.lead.groupBy({
        by: ["source"],
        where: { createdAt: dateFilter as any },
        _count: { id: true },
      }),
      // activity volume by type
      prisma.activity.groupBy({
        by: ["type"],
        where: { createdAt: dateFilter as any },
        _count: { id: true },
      }),
    ]);

  // 3. Build lookup maps
  const leadsMap = new Map(leadGroups.map((g) => [g.agentId, g._count.id]));

  const leadIdsWithActivity = activityCountsByLead
    .map((g) => g.leadId)
    .filter((id): id is string => id !== null);
  const leadsForActivityMap = leadIdsWithActivity.length > 0
    ? await prisma.lead.findMany({
        where: { id: { in: leadIdsWithActivity } },
        select: { id: true, agentId: true },
      })
    : [];
  const leadIdToAgentId = new Map(leadsForActivityMap.map((l) => [l.id, l.agentId]));

  const activitiesMap = new Map<string, number>();
  for (const g of activityCountsByLead) {
    if (!g.leadId) continue;
    const aid = leadIdToAgentId.get(g.leadId);
    if (aid) activitiesMap.set(aid, (activitiesMap.get(aid) ?? 0) + g._count.id);
  }

  const pipelineMap = new Map(pipelineGroups.map((g) => [g.agentId, g._count.id]));
  const closedMap = new Map(closedGroups.map((g) => [g.agentId, g._count.id]));

  // speed-to-lead: group by agentId, average (lastContactedAt - createdAt) in hours
  const speedMap = new Map<string, number[]>();
  for (const l of speedLeads) {
    if (!l.agentId || !l.lastContactedAt) continue;
    const diffHours = (l.lastContactedAt.getTime() - l.createdAt.getTime()) / 3_600_000;
    const arr = speedMap.get(l.agentId) ?? [];
    arr.push(diffHours);
    speedMap.set(l.agentId, arr);
  }

  const avgSpeedFor = (agentId: string): number | null => {
    const diffs = speedMap.get(agentId);
    if (!diffs || diffs.length === 0) return null;
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  };

  // 4. Build leaderboard
  const leaderboard = agents
    .map((agent) => {
      return {
        agentId: agent.id,
        displayName: agent.displayName,
        leadsOwned: leadsMap.get(agent.id) ?? 0,
        activitiesLogged: activitiesMap.get(agent.id) ?? 0,
        dealsInPipeline: pipelineMap.get(agent.id) ?? 0,
        dealsClosed: closedMap.get(agent.id) ?? 0,
        avgSpeedToLeadHours: avgSpeedFor(agent.id),
      };
    })
    .sort((a, b) => b.activitiesLogged - a.activitiesLogged);

  // 5. Source breakdown
  const sourceTotal = sourceGroups.reduce((s, g) => s + g._count.id, 0);
  const sourceBreakdown = sourceGroups
    .map((g) => ({
      source: g.source as string,
      count: g._count.id,
      percent: sourceTotal > 0 ? Math.round((g._count.id / sourceTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 6. Activity volume — include all 6 types, zero-fill missing
  const activityMap = new Map(activityGroups.map((g) => [g.type as string, g._count.id]));
  const activityVolume = ALL_ACTIVITY_TYPES.map((type) => ({
    type,
    count: activityMap.get(type) ?? 0,
  }));

  // 7. Speed-to-lead panel (same data as leaderboard, different shape)
  const speedToLead = agents
    .map((agent) => {
      const avgHours = avgSpeedFor(agent.id);
      return {
        agentId: agent.id,
        displayName: agent.displayName,
        avgHours,
        display: formatSpeedToLead(avgHours),
      };
    })
    .sort((a, b) => {
      if (a.avgHours === null && b.avgHours === null) return 0;
      if (a.avgHours === null) return 1;
      if (b.avgHours === null) return -1;
      return a.avgHours - b.avgHours;
    });

  return NextResponse.json({ leaderboard, sourceBreakdown, activityVolume, speedToLead });
}
