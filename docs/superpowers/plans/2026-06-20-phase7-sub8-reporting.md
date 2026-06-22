# Phase 7 Sub-project 8: Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Admin Reports page and an Agent "My Stats" dashboard tab so Ryan can see team performance and agents can track their own activity.

**Architecture:** Two GET-only API routes aggregate data from existing `Lead`, `Activity`, `Deal`, and `Agent` tables — no schema changes. The Admin page is a new standalone client component at `/admin/reports`. The Agent view is a tab toggle added to the existing `/dashboard` server page, which passes its stats down to a new `DashboardTabs` client component.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma ORM, PostgreSQL, Tailwind CSS, Framer Motion, vitest.

## Global Constraints

- `requireAuth` from `@/lib/api-auth` — destructure `{ session, error }`, return `error` immediately if present.
- `export const dynamic = "force-dynamic"` on every route and client page that reads session.
- Gold accent color: `#9E8C61`. Off-white background: `#F2F0EF`. Dark text: `#1B1B1B`.
- CTA/pill buttons: `motion.button` with `animate={PULSE_ANIMATE}`, `transition={PULSE_TRANSITION}`, `whileHover={{ scale: 1.05, transition: SPRING_HOVER }}` — all three constants from `@/lib/motion`.
- No toast library — inline error state only.
- Admin pages live at `(dashboard)/admin/` (not `(dashboard)/dashboard/admin/`).
- Prisma model for lead activities is `prisma.activity` (field: `leadId`, `type`, `createdAt`) — NOT `prisma.leadActivity`.
- `DealStage.OFFER_ACCEPTED` = deals closed; `DealStage.FALLEN_OUT` and `DealStage.OFFER_ACCEPTED` = excluded from pipeline count.
- Date range helper `getDateFilter(range)` returns `{ gte: Date } | {}` — reused across both API routes.
- No skeleton loaders — "Loading…" text only while fetching.
- No new Prisma schema or migrations.

---

## File Map

**Create:**
- `apps/web/src/app/api/admin/reports/route.ts` — GET /api/admin/reports?range=
- `apps/web/src/app/api/reports/my-stats/route.ts` — GET /api/reports/my-stats?range=
- `apps/web/src/app/(dashboard)/admin/reports/page.tsx` — Admin reports client page
- `apps/web/src/components/dashboard/DashboardTabs.tsx` — Agent tab switcher client component
- `apps/web/src/__tests__/api/reports.test.ts` — 8 vitest tests

**Modify:**
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — wrap existing content in `<DashboardTabs>`

---

## Task 1: API Routes — Admin Reports + My Stats

**Files:**
- Create: `apps/web/src/app/api/admin/reports/route.ts`
- Create: `apps/web/src/app/api/reports/my-stats/route.ts`
- Test: `apps/web/src/__tests__/api/reports.test.ts`

**Interfaces:**
- Consumes: `requireAuth` from `@/lib/api-auth`, `prisma` from `@/lib/prisma`
- Produces:
  - `GET /api/admin/reports?range=` → `{ leaderboard, sourceBreakdown, activityVolume, speedToLead }`
  - `GET /api/reports/my-stats?range=` → `{ summary, sourceBreakdown, activityBreakdown }`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/reports.test.ts` with this exact content:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: vi.fn(), findUnique: vi.fn() },
    lead: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    activity: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    deal: { groupBy: vi.fn(), count: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET as GET_ADMIN } from "../../app/api/admin/reports/route";
import { GET as GET_MY_STATS } from "../../app/api/reports/my-stats/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN" } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT" } };

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

// ─── GET /api/admin/reports ───────────────────────────────────────────────────

describe("GET /api/admin/reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin (AGENT role)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with leaderboard, sourceBreakdown, activityVolume, speedToLead", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      { id: "a1", displayName: "Alice" } as any,
    ]);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([
      { agentId: "a1", _count: { id: 3 } } as any,
    ]);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      { lead: { agentId: "a1" }, type: "CALL" } as any,
      { lead: { agentId: "a1" }, type: "NOTE" } as any,
    ]);
    vi.mocked(prisma.deal.groupBy)
      .mockResolvedValueOnce([{ agentId: "a1", _count: { id: 1 } } as any]) // pipeline
      .mockResolvedValueOnce([{ agentId: "a1", _count: { id: 2 } } as any]); // closed
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      {
        agentId: "a1",
        createdAt: new Date("2026-06-01T09:00:00Z"),
        lastContactedAt: new Date("2026-06-01T11:00:00Z"),
      } as any,
    ]);

    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports?range=month"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("leaderboard");
    expect(body).toHaveProperty("sourceBreakdown");
    expect(body).toHaveProperty("activityVolume");
    expect(body).toHaveProperty("speedToLead");
    expect(body.leaderboard[0]).toMatchObject({
      agentId: "a1",
      displayName: "Alice",
      leadsOwned: 3,
      activitiesLogged: 2,
      dealsInPipeline: 1,
      dealsClosed: 2,
    });
  });

  it("defaults to month range when no range param", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.deal.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);

    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("leaderboard");
  });
});

// ─── GET /api/reports/my-stats ────────────────────────────────────────────────

describe("GET /api/reports/my-stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when no Agent record exists for the user", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with summary, sourceBreakdown, activityBreakdown for agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "a1" } as any);
    vi.mocked(prisma.lead.count)
      .mockResolvedValueOnce(5)  // leadsThisPeriod
      .mockResolvedValueOnce(2)  // dealsInPipeline
      .mockResolvedValueOnce(1); // dealsClosed
    vi.mocked(prisma.activity.count).mockResolvedValue(10);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([
      { source: "WEBSITE", _count: { id: 3 } } as any,
      { source: "REFERRAL", _count: { id: 2 } } as any,
    ]);
    vi.mocked(prisma.activity.groupBy).mockResolvedValue([
      { type: "CALL", _count: { id: 4 } } as any,
      { type: "NOTE", _count: { id: 6 } } as any,
    ]);

    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats?range=month"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toMatchObject({
      leadsThisPeriod: 5,
      activitiesLogged: 10,
      dealsInPipeline: 2,
      dealsClosed: 1,
    });
    expect(body.sourceBreakdown).toHaveLength(2);
    expect(body.activityBreakdown).toHaveLength(6); // all 6 types always present
  });

  it("returns 200 with range=week and correct structure", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "a1" } as any);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);
    vi.mocked(prisma.activity.count).mockResolvedValue(0);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.activity.groupBy).mockResolvedValue([]);

    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats?range=week"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("sourceBreakdown");
    expect(body).toHaveProperty("activityBreakdown");
    expect(body.activityBreakdown).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run tests to confirm all 8 fail**

```powershell
pnpm --filter web exec vitest run src/__tests__/api/reports.test.ts
```

Expected: 8 tests fail with import errors (routes don't exist yet).

- [ ] **Step 3: Create the shared date-range helper and implement `/api/admin/reports`**

Create `apps/web/src/app/api/admin/reports/route.ts`:

```typescript
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
```

- [ ] **Step 4: Implement `/api/reports/my-stats`**

Create `apps/web/src/app/api/reports/my-stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const ALL_ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL", "SHOWING", "OFFER", "DOCUMENT"] as const;
const ALL_SOURCES = ["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"] as const;

function getDateFilter(range: string | null): { gte: Date } | {} {
  const now = new Date();
  switch (range) {
    case "week": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return { gte: d };
    }
    case "30d":
      return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case "90d":
      return { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    case "year":
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case "all":
      return {};
    case "month":
    default:
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
}

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

  const [leadsThisPeriod, activitiesLogged, dealsInPipeline, dealsClosed, sourceGroups, activityGroups] =
    await Promise.all([
      prisma.lead.count({
        where: { agentId: agent.id, createdAt: dateFilter as any },
      }),
      prisma.activity.count({
        where: {
          createdAt: dateFilter as any,
          lead: { agentId: agent.id },
        },
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
```

- [ ] **Step 5: Run tests — confirm all 8 pass**

```powershell
pnpm --filter web exec vitest run src/__tests__/api/reports.test.ts
```

Expected: 8/8 tests passing, 0 failures.

- [ ] **Step 6: Run full test suite to check for regressions**

```powershell
pnpm --filter web exec vitest run
```

Expected: no new failures beyond the pre-existing baseline (10 failures from Upstash Redis + sgMail issues).

- [ ] **Step 7: TypeScript check**

```powershell
pnpm --filter web exec tsc --noEmit
```

Expected: no new errors in the two new route files.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/src/app/api/admin/reports/route.ts apps/web/src/app/api/reports/my-stats/route.ts apps/web/src/__tests__/api/reports.test.ts
git commit -m "feat(sub8): admin reports + my-stats API routes"
```

---

## Task 2: Admin Reports Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/reports/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/reports?range=` from Task 1
- Produces: `/admin/reports` client page with range picker + 4 panels

- [ ] **Step 1: Create the admin reports page**

Create `apps/web/src/app/(dashboard)/admin/reports/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type RangeValue = "week" | "month" | "30d" | "90d" | "year" | "all";

const RANGES: { value: RangeValue; label: string }[] = [
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "30d",   label: "Last 30 Days" },
  { value: "90d",   label: "Last 90 Days" },
  { value: "year",  label: "This Year" },
  { value: "all",   label: "All Time" },
];

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE:    "Website",
  REFERRAL:   "Referral",
  SOCIAL:     "Social Media",
  OPEN_HOUSE: "Open House",
  COLD_CALL:  "Cold Call",
  OTHER:      "Other",
};

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE:     "Note",
  CALL:     "Call",
  EMAIL:    "Email",
  SHOWING:  "Showing",
  OFFER:    "Offer",
  DOCUMENT: "Document",
};

type LeaderboardRow = {
  agentId: string;
  displayName: string | null;
  leadsOwned: number;
  activitiesLogged: number;
  dealsInPipeline: number;
  dealsClosed: number;
};

type SourceRow = { source: string; count: number; percent: number };
type ActivityRow = { type: string; count: number };
type SpeedRow = { agentId: string; displayName: string | null; avgHours: number | null; display: string };

type ReportData = {
  leaderboard: LeaderboardRow[];
  sourceBreakdown: SourceRow[];
  activityVolume: ActivityRow[];
  speedToLead: SpeedRow[];
};

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeValue>("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reports?range=${range}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load reports");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Reports</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">Performance metrics for your team</p>
        </div>
        {/* Range picker */}
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                range === r.value
                  ? "border-[#9E8C61] bg-[#9E8C61] text-white"
                  : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#9E8C61] hover:text-[#9E8C61]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Leaderboard */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
              <h2 className="text-sm font-medium text-[#1B1B1B]">Leaderboard</h2>
            </div>
            {data.leaderboard.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                No agent data for this period.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                    <th className="px-5 py-2 text-left font-medium">Agent</th>
                    <th className="px-5 py-2 text-right font-medium">Leads</th>
                    <th className="px-5 py-2 text-right font-medium">Activities</th>
                    <th className="px-5 py-2 text-right font-medium">Pipeline</th>
                    <th className="px-5 py-2 text-right font-medium">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((row, i) => (
                    <tr
                      key={row.agentId}
                      className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                    >
                      <td className="px-5 py-3 font-medium text-[#1B1B1B]">
                        {row.displayName ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.leadsOwned}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.activitiesLogged}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.dealsInPipeline}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.dealsClosed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Lead Sources + Speed-to-Lead side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Lead Sources */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">Lead Sources</h2>
              </div>
              {data.sourceBreakdown.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                  No leads for this period.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                      <th className="px-5 py-2 text-left font-medium">Source</th>
                      <th className="px-5 py-2 text-right font-medium">Count</th>
                      <th className="px-5 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sourceBreakdown.map((row, i) => (
                      <tr
                        key={row.source}
                        className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                      >
                        <td className="px-5 py-3 text-[#1B1B1B]">
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.count}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Speed to Lead */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">Speed to Lead</h2>
              </div>
              {data.speedToLead.every((r) => r.avgHours === null) ? (
                <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                  No contact data for this period.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                      <th className="px-5 py-2 text-left font-medium">Agent</th>
                      <th className="px-5 py-2 text-right font-medium">Avg Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.speedToLead.map((row, i) => (
                      <tr
                        key={row.agentId}
                        className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                      >
                        <td className="px-5 py-3 text-[#1B1B1B]">
                          {row.displayName ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.display}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Activity Volume */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
              <h2 className="text-sm font-medium text-[#1B1B1B]">Activity Volume</h2>
            </div>
            <div className="flex flex-wrap gap-4 px-5 py-4">
              {data.activityVolume.map((row) => (
                <div
                  key={row.type}
                  className="rounded-xl border border-[#1B1B1B]/10 px-4 py-2"
                >
                  <span className="text-xs font-medium text-[#1B1B1B]/50">
                    {ACTIVITY_LABELS[row.type] ?? row.type}:
                  </span>{" "}
                  <span className="tabular-nums text-sm font-medium text-[#1B1B1B]">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify the page loads**

```powershell
pnpm --filter web dev
```

Open `http://localhost:3000/admin/reports` while logged in as an ADMIN user. Confirm:
- Page loads with "Reports" heading and range picker pills
- "This Month" is selected by default (gold bg)
- Clicking a different range re-fetches (watch Network tab)
- All four panels render (leaderboard, lead sources, speed to lead, activity volume)
- "Loading…" shows briefly while fetching

- [ ] **Step 3: TypeScript check**

```powershell
pnpm --filter web exec tsc --noEmit
```

Expected: no new errors in `apps/web/src/app/(dashboard)/admin/reports/page.tsx`.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/app/(dashboard)/admin/reports/page.tsx
git commit -m "feat(sub8): admin reports page"
```

---

## Task 3: Agent Dashboard Tab (DashboardTabs + dashboard/page.tsx update)

**Files:**
- Create: `apps/web/src/components/dashboard/DashboardTabs.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/reports/my-stats?range=` from Task 1
  - `StatsCard` from `@/components/dashboard/StatsCard`
  - `DeadlineAlerts` from `@/components/dashboard/DeadlineAlerts`
- Produces: `<DashboardTabs overviewStats={...} />` — client tab switcher embedded in the dashboard server page

- [ ] **Step 1: Create `DashboardTabs.tsx`**

Create `apps/web/src/components/dashboard/DashboardTabs.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { StatsCard } from "@/components/dashboard/StatsCard";

type RangeValue = "week" | "month" | "30d" | "90d" | "year" | "all";

const RANGES: { value: RangeValue; label: string }[] = [
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "30d",   label: "Last 30 Days" },
  { value: "90d",   label: "Last 90 Days" },
  { value: "year",  label: "This Year" },
  { value: "all",   label: "All Time" },
];

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE:    "Website",
  REFERRAL:   "Referral",
  SOCIAL:     "Social Media",
  OPEN_HOUSE: "Open House",
  COLD_CALL:  "Cold Call",
  OTHER:      "Other",
};

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE:     "Note",
  CALL:     "Call",
  EMAIL:    "Email",
  SHOWING:  "Showing",
  OFFER:    "Offer",
  DOCUMENT: "Document",
};

type OverviewStats = {
  total: number;
  newThisWeek: number;
  active: number;
  closed: number;
};

type MyStatsData = {
  summary: {
    leadsThisPeriod: number;
    activitiesLogged: number;
    dealsInPipeline: number;
    dealsClosed: number;
  };
  sourceBreakdown: { source: string; count: number; percent: number }[];
  activityBreakdown: { type: string; count: number }[];
};

export function DashboardTabs({ overviewStats }: { overviewStats: OverviewStats }) {
  const [tab, setTab] = useState<"overview" | "my-stats">("overview");
  const [range, setRange] = useState<RangeValue>("month");
  const [myStats, setMyStats] = useState<MyStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch my stats whenever the tab is active or range changes
  useEffect(() => {
    if (tab !== "my-stats") return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/reports/my-stats?range=${range}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setMyStats)
      .catch((e) => { if (e.name !== "AbortError") setError("Failed to load stats"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tab, range]);

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-6 flex gap-2">
        {(["overview", "my-stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "border-[#9E8C61] bg-[#9E8C61] text-white"
                : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#9E8C61] hover:text-[#9E8C61]"
            }`}
          >
            {t === "overview" ? "Overview" : "My Stats"}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      <div className={tab === "overview" ? "" : "hidden"}>
        <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Overview</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard label="Total Leads" value={overviewStats.total} />
          <StatsCard label="New This Week" value={overviewStats.newThisWeek} />
          <StatsCard label="Active Pipeline" value={overviewStats.active} />
          <StatsCard label="Closed" value={overviewStats.closed} />
        </div>
      </div>

      {/* My Stats tab */}
      <div className={tab === "my-stats" ? "" : "hidden"}>
        <div className="mb-6 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                range === r.value
                  ? "border-[#9E8C61] bg-[#9E8C61] text-white"
                  : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#9E8C61] hover:text-[#9E8C61]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && myStats && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatsCard label="Leads This Period" value={myStats.summary.leadsThisPeriod} />
              <StatsCard label="Activities Logged" value={myStats.summary.activitiesLogged} />
              <StatsCard label="Deals in Pipeline" value={myStats.summary.dealsInPipeline} />
              <StatsCard label="Deals Closed" value={myStats.summary.dealsClosed} />
            </div>

            {/* My Lead Sources */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">My Lead Sources</h2>
              </div>
              {myStats.sourceBreakdown.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                  No leads for this period.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                      <th className="px-5 py-2 text-left font-medium">Source</th>
                      <th className="px-5 py-2 text-right font-medium">Count</th>
                      <th className="px-5 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myStats.sourceBreakdown.map((row, i) => (
                      <tr
                        key={row.source}
                        className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                      >
                        <td className="px-5 py-3 text-[#1B1B1B]">
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.count}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* My Activity Breakdown */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">My Activity Breakdown</h2>
              </div>
              <div className="flex flex-wrap gap-4 px-5 py-4">
                {myStats.activityBreakdown.map((row) => (
                  <div
                    key={row.type}
                    className="rounded-xl border border-[#1B1B1B]/10 px-4 py-2"
                  >
                    <span className="text-xs font-medium text-[#1B1B1B]/50">
                      {ACTIVITY_LABELS[row.type] ?? row.type}:
                    </span>{" "}
                    <span className="tabular-nums text-sm font-medium text-[#1B1B1B]">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `dashboard/page.tsx` to use `DashboardTabs`**

Replace the entire contents of `apps/web/src/app/(dashboard)/dashboard/page.tsx` with:

```typescript
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  let total = 0, newThisWeek = 0, active = 0, closed = 0;

  try {
    const agent = role !== "ADMIN"
      ? await prisma.agent.findUnique({ where: { userId } })
      : null;

    const where = agent ? { agentId: agent.id } : {};
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    [total, newThisWeek, active, closed] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { ...where, status: { notIn: ["CLOSED", "LOST"] } } }),
      prisma.lead.count({ where: { ...where, status: "CLOSED" } }),
    ]);
  } catch {
    // Shows zeros on DB error — better than crashing
  }

  return (
    <div>
      <DeadlineAlerts />
      <DashboardTabs overviewStats={{ total, newThisWeek, active, closed }} />
    </div>
  );
}
```

- [ ] **Step 3: Start dev server and verify both tabs work**

```powershell
pnpm --filter web dev
```

Open `http://localhost:3000/dashboard` while logged in as an AGENT user. Confirm:
- Tab switcher shows "Overview" | "My Stats" pills — "Overview" gold by default
- Overview tab: shows the same 4 StatsCards + DeadlineAlerts as before
- Click "My Stats" tab: range picker appears + "Loading…" briefly + 3 panels render
- Change range: data re-fetches
- Toggle back to "Overview": existing stats still there without re-fetching

Also open `http://localhost:3000/dashboard` as ADMIN user and confirm the Overview tab still shows all-agent stats (same behavior as before this change).

- [ ] **Step 4: TypeScript check**

```powershell
pnpm --filter web exec tsc --noEmit
```

Expected: no new errors in the modified/created files.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/components/dashboard/DashboardTabs.tsx apps/web/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(sub8): agent My Stats tab on dashboard"
```
