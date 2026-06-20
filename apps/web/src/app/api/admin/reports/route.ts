import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const ALL_ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL", "SHOWING", "OFFER", "DOCUMENT"] as const;

function getDateFilter(range: string | null): { gte: Date } | {} {
  const now = new Date();
  switch (range) {
    case "week": {
      const d = new Date(now);
      const day = d.getDay(); // 0 = Sunday
      const diff = day === 0 ? 6 : day - 1; // days since Monday
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return { gte: d };
    }
    case "30d":
      return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case "90d":
      return { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    case "year": {
      return { gte: new Date(now.getFullYear(), 0, 1) };
    }
    case "all":
      return {};
    case "month":
    default: {
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
  }
}

function formatSpeedToLead(avgHours: number | null): string {
  if (avgHours === null) return "—";
  if (avgHours < 1) return "< 1h";
  if (avgHours < 24) {
    const h = Math.floor(avgHours);
    const m = Math.round((avgHours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(avgHours / 24);
  const h = Math.floor(avgHours % 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

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
  const [leadGroups, activities, pipelineGroups, closedGroups, speedLeads, sourceGroups, activityGroups] =
    await Promise.all([
      // leads owned per agent in range
      prisma.lead.groupBy({
        by: ["agentId"],
        where: { createdAt: dateFilter as any, agentId: { not: null } },
        _count: { id: true },
      }),
      // all activities in range with their lead's agentId
      prisma.activity.findMany({
        where: { createdAt: dateFilter as any, leadId: { not: null } },
        select: { type: true, lead: { select: { agentId: true } } },
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

  const activitiesMap = new Map<string, number>();
  for (const a of activities) {
    const aid = a.lead?.agentId;
    if (aid) activitiesMap.set(aid, (activitiesMap.get(aid) ?? 0) + 1);
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

  // 4. Build leaderboard
  const leaderboard = agents
    .map((agent) => {
      const diffs = speedMap.get(agent.id);
      const avgSpeedToLeadHours =
        diffs && diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
      return {
        agentId: agent.id,
        displayName: agent.displayName,
        leadsOwned: leadsMap.get(agent.id) ?? 0,
        activitiesLogged: activitiesMap.get(agent.id) ?? 0,
        dealsInPipeline: pipelineMap.get(agent.id) ?? 0,
        dealsClosed: closedMap.get(agent.id) ?? 0,
        avgSpeedToLeadHours,
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
      const diffs = speedMap.get(agent.id);
      const avgHours =
        diffs && diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
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
