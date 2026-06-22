# Sub-project 8: Reporting — Design Spec

**Date:** 2026-06-20
**Phase:** 7 (CRM Expansion)
**Sub-project:** 8 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

Reporting gives Ryan visibility into how his team is performing and where leads come from, and gives each agent a personal view of their own activity. No new database schema is needed — all metrics are aggregated from existing tables (leads, activities, deals, agents).

Two surfaces:
- **Admin Reports** at `/admin/reports` — Ryan's full dashboard: leaderboard, lead source breakdown, speed-to-lead per agent, team activity volume.
- **Agent My Stats tab** on `/dashboard` — each agent's personal panel: summary cards, their lead sources, their activity breakdown.

Both surfaces share the same six preset date ranges. No goal setting — cut from scope.

---

## Section 1: Data Model

**No schema changes.** All metrics derive from existing tables:

| Metric | Source |
|---|---|
| Leads owned | `Lead` (filter by `agentId`, `createdAt`) |
| Lead source breakdown | `Lead` (group by `source`) |
| Speed-to-lead | `Lead` (`lastContactedAt - createdAt`, only non-null `lastContactedAt`) |
| Activities logged | `LeadActivity` (filter by `createdAt`, join to `Lead.agentId`) |
| Deals in pipeline | `Deal` (filter by `agentId`, exclude `FALLEN_OUT` + `OFFER_ACCEPTED`) |
| Deals closed | `Deal` (filter by `agentId`, stage = `OFFER_ACCEPTED`, `stageUpdatedAt` in range) |

---

## Section 2: Date Ranges

Both API routes accept a `?range=` query param. Valid values and their meanings:

| Value | Label | Start date |
|---|---|---|
| `week` | This Week | Monday 00:00:00 of the current week |
| `month` | This Month | 1st of the current month 00:00:00 |
| `30d` | Last 30 Days | Today − 30 days |
| `90d` | Last 90 Days | Today − 90 days |
| `year` | This Year | Jan 1 00:00:00 of the current year |
| `all` | All Time | No date filter |

If `range` is missing or invalid, default to `month`.

**"This Week" definition:** Monday = day 1. If today is Sunday (day 0), the week start is 6 days ago (previous Monday).

The date calculation produces either a `{ gte: Date }` Prisma filter or `{}` (for `all`). Apply this filter to the primary entity's timestamp field (e.g., `lead.createdAt`, `activity.createdAt`, `deal.createdAt`). For "deals closed," apply the date filter to `deal.stageUpdatedAt` instead of `createdAt`.

---

## Section 3: API Routes

### `GET /api/admin/reports?range=`

Auth: `requireAuth("ADMIN")`. `export const dynamic = "force-dynamic"`.

Computes all four panels in one request and returns them as a single JSON object.

**Response shape:**

```ts
{
  leaderboard: {
    agentId: string;
    displayName: string | null;
    leadsOwned: number;
    activitiesLogged: number;
    dealsInPipeline: number;
    dealsClosed: number;
    avgSpeedToLeadHours: number | null; // null if no contacted leads in range
  }[];

  sourceBreakdown: {
    source: string; // "WEBSITE" | "REFERRAL" | "SOCIAL" | "OPEN_HOUSE" | "COLD_CALL" | "OTHER"
    count: number;
    percent: number; // 0–100, rounded to 1 decimal
  }[];

  activityVolume: {
    type: string; // "NOTE" | "CALL" | "EMAIL" | "SHOWING" | "OFFER" | "DOCUMENT"
    count: number;
  }[];

  speedToLead: {
    agentId: string;
    displayName: string | null;
    avgHours: number | null; // null if no contacted leads in range
    display: string; // "2h 15m", "< 1h", "1d 3h", or "—" if null
  }[];
}
```

**Leaderboard computation:**

1. Fetch all agents: `prisma.agent.findMany({ select: { id, displayName } })`
2. For each panel, aggregate counts:
   - `leadsOwned`: `prisma.lead.groupBy({ by: ['agentId'], where: { createdAt: dateFilter }, _count: { id: true } })`
   - `activitiesLogged`: fetch all `LeadActivity` records in range with their `lead.agentId`, group by agentId in JS
   - `dealsInPipeline`: `prisma.deal.groupBy({ by: ['agentId'], where: { createdAt: dateFilter, stage: { notIn: ['FALLEN_OUT', 'OFFER_ACCEPTED'] } }, _count: { id: true } })`
   - `dealsClosed`: `prisma.deal.groupBy({ by: ['agentId'], where: { stageUpdatedAt: dateFilter, stage: 'OFFER_ACCEPTED' }, _count: { id: true } })`
   - `avgSpeedToLeadHours`: fetch leads in range where `lastContactedAt IS NOT NULL`, compute `(lastContactedAt - createdAt)` per lead in JS, average per agentId
3. Merge all maps onto the agents list. Agents with no data in range get zeros.
4. Sort leaderboard by `activitiesLogged` descending by default (client can re-sort).

**Source breakdown computation:**

```
prisma.lead.groupBy({ by: ['source'], where: { createdAt: dateFilter }, _count: { id: true } })
```

Compute percent as `(count / total) * 100`, rounded to 1 decimal.

**Activity volume computation:**

```
prisma.leadActivity.groupBy({ by: ['type'], where: { createdAt: dateFilter }, _count: { id: true } })
```

Include all 6 types; types with no records show count 0.

**Speed-to-lead display format:**

```
null → "—"
< 1 hour → "< 1h"
< 24 hours → "Xh Ym"  (e.g., "2h 15m")
≥ 24 hours → "Xd Yh"  (e.g., "1d 3h")
```

---

### `GET /api/reports/my-stats?range=`

Auth: `requireAuth("AGENT")`. `export const dynamic = "force-dynamic"`.

Resolves the calling user's agent record, then returns stats scoped to that agent only.

**Response shape:**

```ts
{
  summary: {
    leadsThisPeriod: number;
    activitiesLogged: number;
    dealsInPipeline: number;
    dealsClosed: number;
  };

  sourceBreakdown: {
    source: string;
    count: number;
    percent: number;
  }[];

  activityBreakdown: {
    type: string;
    count: number;
  }[];
}
```

**Computation:**

1. Resolve agent: `prisma.agent.findUnique({ where: { userId: session.user.id } })` → 403 if not found
2. `leadsThisPeriod`: count leads where `agentId = agent.id AND createdAt in range`
3. `activitiesLogged`: count `LeadActivity` records where `lead.agentId = agent.id AND createdAt in range`
4. `dealsInPipeline`: count deals where `agentId = agent.id AND stage NOT IN (FALLEN_OUT, OFFER_ACCEPTED) AND createdAt in range`
5. `dealsClosed`: count deals where `agentId = agent.id AND stage = OFFER_ACCEPTED AND stageUpdatedAt in range`
6. `sourceBreakdown`: group leads by source (same pattern as admin, but filtered to agent)
7. `activityBreakdown`: group activities by type (same pattern, filtered to agent's leads)

---

## Section 4: Admin Reports Page

**File:** `apps/web/src/app/(dashboard)/admin/reports/page.tsx`

Client component (`"use client"`). Follows the same pattern as `/admin/action-plans/page.tsx`.

`export const dynamic = "force-dynamic"` (reads session indirectly via fetch).

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Reports                                [range picker pills]  │
│ Performance metrics for your team                           │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐                     │
│ │ Leaderboard (full width)            │                     │
│ │ Name | Leads | Activities | Pipeline| Closed              │
│ └─────────────────────────────────────┘                     │
│ ┌────────────────┐  ┌─────────────────────────────────────┐ │
│ │ Lead Sources   │  │ Speed to Lead (per agent)           │ │
│ │ Source | Count │  │ Agent | Avg Speed                   │ │
│ └────────────────┘  └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐                     │
│ │ Activity Volume (full width)        │                     │
│ │ Note | Call | Email | Showing | ... │                     │
│ └─────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Range Picker

Pill buttons row, same style as action type pills in TriggerDrawer. Gold border + bg on selected, muted on unselected. Default: `month`.

```tsx
const RANGES = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
] as const;
```

When range changes, re-fetch `/api/admin/reports?range=<value>`.

### Leaderboard Panel

White card with rounded corners, `shadow-sm`. Table with columns:

| Column | Source | Notes |
|---|---|---|
| Agent | `displayName` | Left-align |
| Leads | `leadsOwned` | Right-align |
| Activities | `activitiesLogged` | Right-align |
| Pipeline | `dealsInPipeline` | Right-align |
| Closed | `dealsClosed` | Right-align |

Rows sorted by `activitiesLogged` descending (server returns pre-sorted). No client-side re-sort needed.

Empty state if no agents: "No agent data for this period."

### Lead Source Breakdown Panel

White card. Table with columns: Source (human-readable label) | Count | %.

Human-readable source labels:
```ts
const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL: "Social Media",
  OPEN_HOUSE: "Open House",
  COLD_CALL: "Cold Call",
  OTHER: "Other",
};
```

Sorted by count descending. Empty state: "No leads for this period."

### Speed-to-Lead Panel

White card. Table with columns: Agent | Avg Response Time.

Uses `display` field from API (`"2h 15m"`, `"< 1h"`, `"1d 3h"`, `"—"`).

Sorted by `avgHours` ascending (fastest responders first), nulls last.

### Activity Volume Panel

White card, full width. Single row of stat pills, one per activity type:

```
Note: 12    Call: 45    Email: 23    Showing: 8    Offer: 3    Document: 7
```

Each pill: activity type label + count. Show all 6 types even if count is 0.

Human-readable activity labels:
```ts
const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  SHOWING: "Showing",
  OFFER: "Offer",
  DOCUMENT: "Document",
};
```

### Loading & Error States

While fetching: show `"Loading…"` text in place of each panel.
On error: show inline `"Failed to load reports"` error message.
No skeleton loaders needed.

---

## Section 5: Agent My Stats Tab

**Files modified:**
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — convert to pass props to new client wrapper
- **Create:** `apps/web/src/components/dashboard/DashboardTabs.tsx` — client component with tab switcher

### Tab Design

Two pill buttons at the top of the dashboard page: **Overview** | **My Stats**. Selected tab is gold. Default: Overview.

```
[ Overview ]  [ My Stats ]
```

**Overview tab** — renders the existing StatsCards + DeadlineAlerts (unchanged).

**My Stats tab** — shows the range picker + 3 reporting panels.

### How it works

The current `/dashboard/page.tsx` is a server component that fetches stats and renders them. To add client-side tab state:

1. The server page fetches the existing stats (`total`, `newThisWeek`, `active`, `closed`) as before.
2. It renders a new `<DashboardTabs>` client component, passing the server-fetched stats as props.
3. `DashboardTabs` renders the tab switcher. The "Overview" tab renders the existing `<StatsCard>` grid using the passed props. The "My Stats" tab fetches from `/api/reports/my-stats?range=` on the client when first selected.

### `DashboardTabs` component props

```ts
type DashboardTabsProps = {
  overviewStats: {
    total: number;
    newThisWeek: number;
    active: number;
    closed: number;
  };
};
```

### My Stats Tab Layout

Range picker (same pill style as admin page, same 6 options, default `month`).

Then three panels:

**Summary Cards** — 4 cards in a 2×2 (or 4-column on lg) grid:
- Leads This Period (`summary.leadsThisPeriod`)
- Activities Logged (`summary.activitiesLogged`)
- Deals in Pipeline (`summary.dealsInPipeline`)
- Deals Closed (`summary.dealsClosed`)

Use the existing `<StatsCard>` component.

**My Lead Sources** — white card, table: Source | Count | %. Same label map as admin page. Sorted by count descending.

**My Activity Breakdown** — white card, same pill row as admin activity volume panel. All 6 types, zero counts shown.

Loading / error state: same as admin page.

---

## Section 6: Tests

**Test file:** `apps/web/src/__tests__/api/reports.test.ts`

**Mock setup:**

```typescript
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: vi.fn(), findUnique: vi.fn() },
    lead: { groupBy: vi.fn(), findMany: vi.fn() },
    leadActivity: { groupBy: vi.fn(), findMany: vi.fn() },
    deal: { groupBy: vi.fn() },
  },
}));
```

**Admin reports tests (`GET /api/admin/reports`):**
- 401 unauthenticated
- 403 non-admin (AGENT role)
- 200 returns leaderboard, sourceBreakdown, activityVolume, speedToLead
- 200 defaults to `month` range when no `range` param

**My stats tests (`GET /api/reports/my-stats`):**
- 401 unauthenticated
- 403 when no Agent record exists for the user
- 200 returns summary, sourceBreakdown, activityBreakdown for agent
- 200 with `range=week` returns correct structure

Total: 8 tests.

---

## Section 7: Files Created / Modified

**Create:**
- `apps/web/src/app/api/admin/reports/route.ts` — GET handler
- `apps/web/src/app/api/reports/my-stats/route.ts` — GET handler
- `apps/web/src/app/(dashboard)/admin/reports/page.tsx` — admin client page
- `apps/web/src/components/dashboard/DashboardTabs.tsx` — tab switcher client component
- `apps/web/src/__tests__/api/reports.test.ts` — 8 vitest tests

**Modify:**
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — pass stats as props to `<DashboardTabs>`

---

## Section 8: Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Who sees reports | Admin (all agents) + agents (own data only) | Consistent with all other Sub7 CRM features |
| Goal setting | Cut | Requires new schema + CRUD UI; core reporting value doesn't need it |
| Date ranges | 6 presets: week, month, 30d, 90d, year, all | Covers daily check-in (week) through long-term trends (all time) |
| Default range | `month` | Most useful day-to-day — "how's this month going?" |
| "This Week" | Monday–today | Standard business week definition |
| Deals closed metric | stage = `OFFER_ACCEPTED` | Most advanced positive stage in DealStage enum |
| Speed-to-lead source | `lastContactedAt - createdAt` | `lastContactedAt` is already tracked on Lead; no activity join needed |
| Agent tab placement | Toggle on `/dashboard` page (Overview / My Stats) | Same page load, consistent with sidebar-based nav, avoids new route |
| Leaderboard sort | By `activitiesLogged` descending | Activity is the best proxy for engagement/effort |
| No skeleton loaders | Loading text only | Consistent with rest of CRM; skeleton loaders cut from scope |
| Real-time queries | No caching | Small brokerage — fast enough without caching complexity |
