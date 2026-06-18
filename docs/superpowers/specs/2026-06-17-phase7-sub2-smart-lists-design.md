# Sub-project 2: Smart Lists — Design Spec

**Date:** 2026-06-17
**Phase:** 7 (CRM Expansion)
**Sub-project:** 2 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

Smart Lists are saved, auto-updating filtered views of an agent's leads. Agents create them once and they always reflect live data. This sub-project adds a second left panel to the Leads page, pre-built lists that work on day one, and a custom filter builder so agents can create their own lists.

**Depends on:** Sub-project 1 (tags, priceMin, priceMax, timeframeToMove, lastContactedAt, LeadTask, PropertyView, HOT_PROSPECT/NURTURE/SPHERE statuses).

**What ships:**
- `SmartList` schema + migration
- 5 pre-built lists (hardcoded, always visible)
- Custom list creation/edit/delete with a 9-filter builder
- Paginated lead results table for any Smart List
- Updated Leads page layout with list sidebar

**What is deferred:**
- Pool Assignment filter → Sub-project 6 (Lead Pool)
- Deal Stage / Deal Price filter → Sub-project 3 (Deal Pipeline)
- Shared Smart Lists (team-visible) → future
- AND/OR logic → future (all conditions are AND for now)

---

## Section 1: Schema

### 1.1 New `SmartList` model

```prisma
model SmartList {
  id        String   @id @default(cuid())
  agentId   String
  name      String
  filters   Json     @default("[]")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agent Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId])
}
```

Add back-relation to `Agent`:
```prisma
smartLists SmartList[]
```

### 1.2 Filter JSON schema

`filters` is an array of condition objects. All conditions are ANDed — every condition must match for a lead to appear.

```ts
type FilterCondition =
  | { field: "status";        operator: "is" | "isNot";       value: string[] }
  | { field: "tags";          operator: "hasAnyOf" | "hasNoneOf"; value: string[] }
  | { field: "lastContacted"; operator: "moreThan" | "lessThan"; value: number }
  | { field: "lastContacted"; operator: "never";               value: null }
  | { field: "timeframe";     operator: "is";                  value: string }
  | { field: "source";        operator: "is" | "isNot";        value: string[] }
  | { field: "priceMin";      operator: "atLeast";             value: number }
  | { field: "priceMax";      operator: "atMost";              value: number }
  | { field: "hasPendingTask";operator: "is";                  value: boolean }
  | { field: "createdDate";   operator: "withinLast" | "moreThan"; value: number }
```

Example — "Hot Prospects in Irvine not contacted in 30 days":
```json
[
  { "field": "status",        "operator": "is",        "value": ["HOT_PROSPECT"] },
  { "field": "tags",          "operator": "hasAnyOf",  "value": ["Irvine"] },
  { "field": "lastContacted", "operator": "moreThan",  "value": 30 }
]
```

---

## Section 2: UI Layout

### 2.1 Leads page restructure

Current layout: full-width Kanban.

New layout: three-column.

```
[Dashboard sidebar 56] | [List sidebar 200px] | [Main content flex-1]
```

The list sidebar sits between the existing dashboard sidebar and the main content area. It has a top border-r and contains:

- **"Kanban"** link at top (default selected state, bold)
- **"+ New List"** button (small, right-aligned or below)
- **Pre-built lists section** (label: "Smart Lists", non-deletable):
  1. New This Week
  2. No Contact in 30 Days
  3. Hot Prospects
  4. Nurture
  5. Sphere
- **Custom lists section** (label: "My Lists", appears only if agent has saved lists):
  - Each list name, click to view results
  - Hover reveals edit (pencil) and delete (×) icons

Active selection is highlighted with the gold accent (`text-[#9E8C61]`, light gold bg).

### 2.2 Main content area

**When "Kanban" is selected:** renders existing `LeadKanban` component unchanged.

**When any Smart List is selected:** renders a paginated results table with columns:

| Name | Status | Tags | Last Contacted | Source | Price Range |
|---|---|---|---|---|---|

- Name links to `/dashboard/leads/[id]`
- Status shows colored badge (existing `LEAD_STATUS_COLORS` from `campaign-ui.ts`)
- Tags shows up to 3 colored pills, "+N more" if exceeded
- Last Contacted shows "X days ago" or "Never"
- Price Range shows "$Xk–$Yk" or "—" if not set
- 25 leads per page, pagination controls at bottom
- Lead count shown above table: "42 leads"
- Empty state: "No leads match this list" with a brief description

### 2.3 URL state

Active list is tracked in the URL via a query param: `/dashboard/leads?list=hot-prospects` for pre-built, `/dashboard/leads?list=[smartListId]` for custom. This makes the view shareable and browser-back-button friendly.

---

## Section 3: Pre-built Lists

Hardcoded in the frontend — no DB rows needed. Pre-built list slugs and their filter JSON:

| Name | Slug | Filter JSON |
|---|---|---|
| New This Week | `new-this-week` | `[{ "field": "createdDate", "operator": "withinLast", "value": 7 }]` |
| No Contact in 30 Days | `no-contact-30` | `[{ "field": "lastContacted", "operator": "moreThan", "value": 30 }]` |
| Hot Prospects | `hot-prospects` | `[{ "field": "status", "operator": "is", "value": ["HOT_PROSPECT"] }]` |
| Nurture | `nurture` | `[{ "field": "status", "operator": "is", "value": ["NURTURE"] }]` |
| Sphere | `sphere` | `[{ "field": "status", "operator": "is", "value": ["SPHERE"] }]` |

"No Contact in 30 Days" matches leads where `lastContactedAt` is null OR more than 30 days ago.

---

## Section 4: Filter Builder

Slide-in drawer from the right, opened by "+ New List" or clicking the edit icon on a custom list.

**Drawer contents:**
1. Name input (required, placeholder "e.g. Buyers in Irvine")
2. Filter conditions list (empty on create)
3. "+ Add Filter" button — appends a new condition row
4. Save button (disabled until name is filled and at least one filter is added)
5. Cancel button

**Each condition row:**
- Field dropdown (9 options listed below)
- Operator dropdown (updates based on field selection)
- Value input (updates based on field + operator)
- × button to remove the condition

**Field → Operator → Value mapping:**

| Field label | `field` key | Operators | Value UI |
|---|---|---|---|
| Status | `status` | is / is not | Multi-select checkboxes (all 11 statuses with labels) |
| Tags | `tags` | has any of / has none of | Multi-select checkboxes (fetched from `/api/admin/tags`) |
| Last Contacted | `lastContacted` | more than X days ago / less than X days ago / never contacted | Number input (hidden for "never") |
| Timeframe to Move | `timeframe` | is | Single select: 0–3 months / 3–6 months / 6–12 months / 12+ months / Unknown |
| Source | `source` | is / is not | Multi-select checkboxes (all lead sources) |
| Min Budget | `priceMin` | at least | Number input (formatted as currency) |
| Max Budget | `priceMax` | at most | Number input (formatted as currency) |
| Has Pending Task | `hasPendingTask` | is | Toggle: Yes / No |
| Created Date | `createdDate` | within last X days / more than X days ago | Number input |

---

## Section 5: API Routes

### 5.1 Smart List CRUD

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/smart-lists` | AGENT | List the calling agent's Smart Lists |
| POST | `/api/smart-lists` | AGENT | Create a Smart List |
| PATCH | `/api/smart-lists/[id]` | AGENT | Update name and/or filters (ownership enforced) |
| DELETE | `/api/smart-lists/[id]` | AGENT | Delete a Smart List (ownership enforced) |

POST/PATCH body:
```ts
{ name: string; filters: FilterCondition[] }
```

### 5.2 Filter execution

```
GET /api/leads?filters=[...]&page=1&pageSize=25
```

- `filters` — URL-encoded JSON array of `FilterCondition[]`
- `page` — 1-indexed, default 1
- `pageSize` — default 25, max 100
- Auth: AGENT (results scoped to calling agent's leads); ADMIN sees all leads
- Returns: `{ leads: LeadRow[], total: number, page: number, pageSize: number }`

The filter-to-Prisma translator lives in `apps/web/src/lib/smart-list-filters.ts` and exports:
```ts
function buildLeadWhere(filters: FilterCondition[], agentId: string | null): Prisma.LeadWhereInput
```

`agentId` is `null` for ADMIN (no agent scope). Each filter condition appends to the `where` object:

- `status is ["HOT_PROSPECT"]` → `{ status: { in: ["HOT_PROSPECT"] } }`
- `tags hasAnyOf ["Irvine"]` → `{ tags: { some: { tag: { name: { in: ["Irvine"] } } } } }`
- `lastContacted moreThan 30` → `{ OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: daysAgo(30) } }] }` — null (never contacted) always counts as "more than X days"
- `lastContacted never` → `{ lastContactedAt: null }`
- `lastContacted lessThan 30` → `{ lastContactedAt: { gt: daysAgo(30), not: null } }`
- `timeframe is "0-3 months"` → `{ timeframeToMove: "0-3 months" }`
- `source is ["OPEN_HOUSE"]` → `{ source: { in: ["OPEN_HOUSE"] } }`
- `priceMin atLeast 500000` → `{ priceMin: { gte: 500000 } }`
- `priceMax atMost 800000` → `{ priceMax: { lte: 800000 } }`
- `hasPendingTask is true` → `{ tasks: { some: { done: false } } }`
- `hasPendingTask is false` → `{ tasks: { none: { done: false } } }`
- `createdDate withinLast 7` → `{ createdAt: { gte: daysAgo(7) } }`
- `createdDate moreThan 7` → `{ createdAt: { lt: daysAgo(7) } }`

Note: `daysAgo(n)` is a local helper — `new Date(Date.now() - n * 86400_000)` — no extra dependency needed.

---

## Section 6: Files Changed / Created

**Schema:**
- `packages/database/prisma/schema.prisma` — add SmartList model + Agent back-relation
- New migration

**Lib:**
- `apps/web/src/lib/smart-list-filters.ts` — `buildLeadWhere()` translator + `FilterCondition` type + `PREBUILT_LISTS` constant

**API routes:**
- `apps/web/src/app/api/smart-lists/route.ts` — GET + POST
- `apps/web/src/app/api/smart-lists/[id]/route.ts` — PATCH + DELETE
- `apps/web/src/app/api/leads/route.ts` — add `filters` + `page` + `pageSize` query param handling

**Components:**
- `apps/web/src/components/leads/SmartListSidebar.tsx` — list sidebar (pre-built + custom lists)
- `apps/web/src/components/leads/SmartListResults.tsx` — paginated results table
- `apps/web/src/components/leads/SmartListDrawer.tsx` — create/edit filter builder drawer

**Pages:**
- `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx` — restructure to 3-column layout, wire up list sidebar and results

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Filter storage | JSON blob | Simple, flexible, easy to extend with new filter types |
| Pre-built lists | Hardcoded in frontend | No DB seeding needed; can't be accidentally deleted |
| AND/OR logic | AND only | Covers 95% of use cases; OR adds significant UI complexity |
| Pagination | 25 per page | Keeps queries fast; agents rarely need to see 100+ leads at once |
| URL state | `?list=slug-or-id` | Shareable, browser-back-button friendly |
| Pool/Deal filters | Deferred | Those models don't exist yet — add in Sub-projects 3 and 6 |
