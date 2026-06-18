# Phase 7 Sub-project 2: Smart Lists — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Smart Lists to the CRM — saved, auto-updating filtered views of leads with a 5-item pre-built sidebar and custom filter builder.

**Architecture:** A `SmartList` model stores filter criteria as a JSON array per agent. A shared `buildLeadWhere()` translator converts filter conditions to Prisma `where` clauses. The Leads page gains a list sidebar that switches the main area between the existing Kanban (no list selected) and a paginated results table (list selected), with URL state via `?list=slug-or-id`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5 + PostgreSQL, Tailwind CSS, Zod v4, NextAuth, vitest

## Global Constraints

- Auth: `requireAuth("AGENT")` from `@/lib/api-auth` for all agent routes; `requireAuth("ADMIN")` for admin-only routes
- Zod errors: always use `err.issues[0].message` — NOT `err.errors[0].message` (project uses Zod v4)
- Brand colors: gold `#9E8C61`, dark `#1B1B1B`, off-white bg `#F2F0EF`; active selection uses `bg-[#9E8C61]/10 text-[#9E8C61]`
- All conditions in a Smart List are ANDed (no OR logic at this stage)
- Pre-built lists are hardcoded constants — never stored in the DB
- `agentId` is `null` for ADMIN role in `buildLeadWhere` (ADMIN sees all leads)
- Date arithmetic: use `new Date(Date.now() - n * 86400_000)` — no date-fns required
- Ownership enforcement: PATCH/DELETE on `/api/smart-lists/[id]` must verify `smartList.agentId === agent.id`
- The `filters` column value from Prisma is typed as `Prisma.JsonValue` — cast to `FilterCondition[]` when reading
- Migration command: `pnpm --filter "@cnc/database" exec prisma migrate dev --name phase7-smart-lists`
- Generate command: `pnpm --filter "@cnc/database" exec prisma generate`
- Test command: `pnpm --filter web test` (runs vitest in `apps/web`)
- Test files must be `*.test.ts` under `apps/web/src/`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Modify | Add SmartList model + Agent back-relation |
| `apps/web/src/lib/smart-list-filters.ts` | Create | FilterCondition type, PREBUILT_LISTS, buildLeadWhere(), resolveListFilters() |
| `apps/web/src/lib/smart-list-filters.test.ts` | Create | Unit tests for buildLeadWhere() |
| `apps/web/src/app/api/smart-lists/route.ts` | Create | GET (list) + POST (create) |
| `apps/web/src/app/api/smart-lists/[id]/route.ts` | Create | PATCH (update) + DELETE |
| `apps/web/src/app/api/tags/route.ts` | Create | GET tags list for agents (read-only, AGENT auth) |
| `apps/web/src/app/api/leads/route.ts` | Modify | GET: add `filters`, `page`, `pageSize` query params + paginated response |
| `apps/web/src/components/leads/SmartListSidebar.tsx` | Create | List panel: Kanban link, pre-built lists, custom lists, "+ New List" button |
| `apps/web/src/components/leads/SmartListResults.tsx` | Create | Paginated lead results table for a given filter set |
| `apps/web/src/components/leads/SmartListDrawer.tsx` | Create | Slide-in filter builder drawer for create/edit |
| `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx` | Modify | 3-column layout, URL state, conditional Kanban vs SmartListResults |

---

### Task 1: Schema — SmartList model + migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `SmartList` model with `id`, `agentId`, `name`, `filters` (Json), `createdAt`, `updatedAt`; `Agent.smartLists` back-relation

- [ ] **Step 1: Add SmartList model and Agent back-relation to schema**

In `packages/database/prisma/schema.prisma`, find the `model Agent { ... }` block and add `smartLists SmartList[]` to its relations list, after the existing `assignedTasks` line:

```prisma
  assignedTasks    LeadTask[]        @relation("TaskAssignee")
  smartLists       SmartList[]
```

Then append the new model at the end of the file (after the last model):

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

- [ ] **Step 2: Run migration**

```
pnpm --filter "@cnc/database" exec prisma migrate dev --name phase7-smart-lists
```

Expected output includes:
```
✔ Database migrations applied successfully
```

If the migration SQL file is created but the DB is sleeping, wait for it to wake (up to 30 seconds) then retry.

- [ ] **Step 3: Remove BOM if present**

The migration tool sometimes writes a UTF-8 BOM character that PostgreSQL rejects. Check and strip it:

```powershell
$path = (Get-ChildItem "packages/database/prisma/migrations" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName + "\migration.sql"
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  [System.IO.File]::WriteAllBytes($path, $bytes[3..($bytes.Length-1)])
  Write-Host "BOM removed"
} else { Write-Host "No BOM" }
```

Then re-run the migration command from Step 2 if BOM was found.

- [ ] **Step 4: Regenerate Prisma client**

```
pnpm --filter "@cnc/database" exec prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(schema): add SmartList model for Phase 7 Smart Lists"
```

---

### Task 2: Filter translator lib + tests

**Files:**
- Create: `apps/web/src/lib/smart-list-filters.ts`
- Create: `apps/web/src/lib/smart-list-filters.test.ts`

**Interfaces:**
- Produces:
  - `FilterCondition` — discriminated union type (exported)
  - `PREBUILT_LISTS` — array of `{ slug, name, filters }` (exported)
  - `buildLeadWhere(filters: FilterCondition[], agentId: string | null): Prisma.LeadWhereInput` (exported)
  - `resolveListFilters(slug: string | null, customLists: Array<{ id: string; filters: unknown }>): FilterCondition[] | null` (exported)

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/smart-list-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildLeadWhere, PREBUILT_LISTS, resolveListFilters } from "./smart-list-filters";

describe("buildLeadWhere", () => {
  it("returns empty object when no filters and no agentId", () => {
    expect(buildLeadWhere([], null)).toEqual({});
  });

  it("scopes to agentId when provided", () => {
    const where = buildLeadWhere([], "agent-1");
    expect(where).toMatchObject({ agentId: "agent-1" });
  });

  it("status is", () => {
    const where = buildLeadWhere([{ field: "status", operator: "is", value: ["HOT_PROSPECT"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ status: { in: ["HOT_PROSPECT"] } }]) });
  });

  it("status isNot", () => {
    const where = buildLeadWhere([{ field: "status", operator: "isNot", value: ["LOST"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ status: { notIn: ["LOST"] } }]) });
  });

  it("tags hasAnyOf", () => {
    const where = buildLeadWhere([{ field: "tags", operator: "hasAnyOf", value: ["Irvine"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tags: { some: { tag: { name: { in: ["Irvine"] } } } } }]) });
  });

  it("tags hasNoneOf", () => {
    const where = buildLeadWhere([{ field: "tags", operator: "hasNoneOf", value: ["Irvine"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tags: { none: { tag: { name: { in: ["Irvine"] } } } } }]) });
  });

  it("lastContacted moreThan includes null (never contacted)", () => {
    const where = buildLeadWhere([{ field: "lastContacted", operator: "moreThan", value: 30 }], null) as any;
    const orClause = where.AND.find((c: any) => c.OR);
    expect(orClause).toBeDefined();
    expect(orClause.OR).toEqual(expect.arrayContaining([{ lastContactedAt: null }]));
  });

  it("lastContacted never", () => {
    const where = buildLeadWhere([{ field: "lastContacted", operator: "never", value: null }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ lastContactedAt: null }]) });
  });

  it("lastContacted lessThan excludes null", () => {
    const where = buildLeadWhere([{ field: "lastContacted", operator: "lessThan", value: 7 }], null) as any;
    const cond = where.AND.find((c: any) => c.lastContactedAt);
    expect(cond.lastContactedAt).toHaveProperty("gt");
    expect(cond.lastContactedAt).toMatchObject({ not: null });
  });

  it("hasPendingTask true", () => {
    const where = buildLeadWhere([{ field: "hasPendingTask", operator: "is", value: true }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tasks: { some: { done: false } } }]) });
  });

  it("hasPendingTask false", () => {
    const where = buildLeadWhere([{ field: "hasPendingTask", operator: "is", value: false }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tasks: { none: { done: false } } }]) });
  });

  it("priceMin atLeast", () => {
    const where = buildLeadWhere([{ field: "priceMin", operator: "atLeast", value: 500000 }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ priceMin: { gte: 500000 } }]) });
  });

  it("createdDate withinLast", () => {
    const where = buildLeadWhere([{ field: "createdDate", operator: "withinLast", value: 7 }], null) as any;
    const cond = where.AND.find((c: any) => c.createdAt);
    expect(cond.createdAt).toHaveProperty("gte");
  });

  it("combines multiple filters", () => {
    const where = buildLeadWhere([
      { field: "status", operator: "is", value: ["HOT_PROSPECT"] },
      { field: "tags", operator: "hasAnyOf", value: ["Irvine"] },
    ], "agent-1") as any;
    expect(where.AND).toHaveLength(3); // agentId + status + tags
  });
});

describe("PREBUILT_LISTS", () => {
  it("has 5 lists with unique slugs", () => {
    expect(PREBUILT_LISTS).toHaveLength(5);
    const slugs = PREBUILT_LISTS.map(l => l.slug);
    expect(new Set(slugs).size).toBe(5);
  });

  it("each list has at least one filter", () => {
    for (const list of PREBUILT_LISTS) {
      expect(list.filters.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveListFilters", () => {
  const customLists = [{ id: "cust-1", name: "My List", filters: [{ field: "status", operator: "is", value: ["NEW"] }] }];

  it("returns null for null slug", () => {
    expect(resolveListFilters(null, [])).toBeNull();
  });

  it("returns prebuilt filters for known slug", () => {
    const filters = resolveListFilters("hot-prospects", []);
    expect(filters).not.toBeNull();
    expect(filters![0]).toMatchObject({ field: "status", operator: "is", value: ["HOT_PROSPECT"] });
  });

  it("returns custom list filters for id", () => {
    const filters = resolveListFilters("cust-1", customLists);
    expect(filters).not.toBeNull();
    expect(filters![0]).toMatchObject({ field: "status", operator: "is", value: ["NEW"] });
  });

  it("returns null for unknown slug", () => {
    expect(resolveListFilters("unknown", [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
pnpm --filter web test -- smart-list-filters
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/smart-list-filters.ts`**

```ts
import type { Prisma } from "@prisma/client";

export type FilterCondition =
  | { field: "status";         operator: "is" | "isNot";              value: string[] }
  | { field: "tags";           operator: "hasAnyOf" | "hasNoneOf";    value: string[] }
  | { field: "lastContacted";  operator: "moreThan" | "lessThan";     value: number }
  | { field: "lastContacted";  operator: "never";                     value: null }
  | { field: "timeframe";      operator: "is";                        value: string }
  | { field: "source";         operator: "is" | "isNot";              value: string[] }
  | { field: "priceMin";       operator: "atLeast";                   value: number }
  | { field: "priceMax";       operator: "atMost";                    value: number }
  | { field: "hasPendingTask"; operator: "is";                        value: boolean }
  | { field: "createdDate";    operator: "withinLast" | "moreThan";   value: number };

export const PREBUILT_LISTS: Array<{ slug: string; name: string; filters: FilterCondition[] }> = [
  { slug: "new-this-week",  name: "New This Week",        filters: [{ field: "createdDate",    operator: "withinLast", value: 7 }] },
  { slug: "no-contact-30",  name: "No Contact in 30 Days",filters: [{ field: "lastContacted",  operator: "moreThan",   value: 30 }] },
  { slug: "hot-prospects",  name: "Hot Prospects",         filters: [{ field: "status",         operator: "is",         value: ["HOT_PROSPECT"] }] },
  { slug: "nurture",        name: "Nurture",               filters: [{ field: "status",         operator: "is",         value: ["NURTURE"] }] },
  { slug: "sphere",         name: "Sphere",                filters: [{ field: "status",         operator: "is",         value: ["SPHERE"] }] },
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400_000);
}

export function buildLeadWhere(
  filters: FilterCondition[],
  agentId: string | null,
): Prisma.LeadWhereInput {
  const conditions: Prisma.LeadWhereInput[] = [];

  if (agentId) conditions.push({ agentId });

  for (const f of filters) {
    switch (f.field) {
      case "status":
        conditions.push(
          f.operator === "is"
            ? { status: { in: f.value as any } }
            : { status: { notIn: f.value as any } },
        );
        break;
      case "tags":
        conditions.push(
          f.operator === "hasAnyOf"
            ? { tags: { some: { tag: { name: { in: f.value } } } } }
            : { tags: { none: { tag: { name: { in: f.value } } } } },
        );
        break;
      case "lastContacted":
        if (f.operator === "moreThan") {
          conditions.push({ OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: daysAgo(f.value) } }] });
        } else if (f.operator === "lessThan") {
          conditions.push({ lastContactedAt: { gt: daysAgo(f.value), not: null } });
        } else {
          conditions.push({ lastContactedAt: null });
        }
        break;
      case "timeframe":
        conditions.push({ timeframeToMove: f.value });
        break;
      case "source":
        conditions.push(
          f.operator === "is"
            ? { source: { in: f.value as any } }
            : { source: { notIn: f.value as any } },
        );
        break;
      case "priceMin":
        conditions.push({ priceMin: { gte: f.value } });
        break;
      case "priceMax":
        conditions.push({ priceMax: { lte: f.value } });
        break;
      case "hasPendingTask":
        conditions.push(
          f.value
            ? { tasks: { some: { done: false } } }
            : { tasks: { none: { done: false } } },
        );
        break;
      case "createdDate":
        conditions.push(
          f.operator === "withinLast"
            ? { createdAt: { gte: daysAgo(f.value) } }
            : { createdAt: { lt: daysAgo(f.value) } },
        );
        break;
    }
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

export function resolveListFilters(
  slug: string | null,
  customLists: Array<{ id: string; filters: unknown }>,
): FilterCondition[] | null {
  if (!slug) return null;
  const prebuilt = PREBUILT_LISTS.find(l => l.slug === slug);
  if (prebuilt) return prebuilt.filters;
  const custom = customLists.find(l => l.id === slug);
  if (custom) return custom.filters as FilterCondition[];
  return null;
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```
pnpm --filter web test -- smart-list-filters
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/smart-list-filters.ts apps/web/src/lib/smart-list-filters.test.ts
git commit -m "feat(lib): add smart-list-filters translator and pre-built list constants"
```

---

### Task 3: Smart List CRUD API + agent tags endpoint

**Files:**
- Create: `apps/web/src/app/api/smart-lists/route.ts`
- Create: `apps/web/src/app/api/smart-lists/[id]/route.ts`
- Create: `apps/web/src/app/api/tags/route.ts`

**Interfaces:**
- Consumes: `requireAuth` from `@/lib/api-auth`, `prisma` from `@/lib/prisma`
- Produces:
  - `GET /api/smart-lists` → `SmartList[]`
  - `POST /api/smart-lists` body `{ name, filters }` → `SmartList` (201)
  - `PATCH /api/smart-lists/[id]` body `{ name?, filters? }` → `SmartList`
  - `DELETE /api/smart-lists/[id]` → 204
  - `GET /api/tags` → `{ id, name, color }[]`

- [ ] **Step 1: Create `apps/web/src/app/api/smart-lists/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(1),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
  })),
});

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json([]);

  const lists = await prisma.smartList.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(lists);
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const list = await prisma.smartList.create({
      data: { agentId: agent.id, name: body.name, filters: body.filters },
    });
    return NextResponse.json(list, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `apps/web/src/app/api/smart-lists/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(1).optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
  })).optional(),
});

async function assertOwnership(listId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const list = await prisma.smartList.findUnique({ where: { id: listId }, select: { agentId: true } });
  return agent && list && list.agentId === agent.id;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const list = await prisma.smartList.update({
      where: { id: params.id },
      data: { ...(body.name && { name: body.name }), ...(body.filters && { filters: body.filters }) },
    });
    return NextResponse.json(list);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    if ((err as any)?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.smartList.delete({ where: { id: params.id } }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Create `apps/web/src/app/api/tags/route.ts`**

This gives agents read access to the tag list (the existing `/api/admin/tags` GET requires ADMIN, which blocks agents from using tags in the filter builder).

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  const tags = await prisma.tag.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}
```

- [ ] **Step 4: Verify routes respond**

Start the dev server (`pnpm dev` from the repo root) and test with curl or browser:

```bash
# Should return 401 (no session)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/smart-lists
# Expected: 401

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tags
# Expected: 401
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/smart-lists/ apps/web/src/app/api/tags/
git commit -m "feat(api): add smart-list CRUD routes and agent tags endpoint"
```

---

### Task 4: Leads GET — filter + pagination support

**Files:**
- Modify: `apps/web/src/app/api/leads/route.ts`

**Interfaces:**
- Consumes: `buildLeadWhere`, `FilterCondition` from `@/lib/smart-list-filters`
- Produces: When `filters` query param present → `{ leads, total, page, pageSize }`; when absent → existing array response (backward compatible)

- [ ] **Step 1: Update `apps/web/src/app/api/leads/route.ts` GET handler**

Replace the existing `GET()` function (lines 54–77) with this — the POST handler is untouched:

```ts
import { buildLeadWhere, FilterCondition } from "@/lib/smart-list-filters";

// Agents see their own leads; ADMIN sees all leads.
export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;
  const url = new URL(req.url);
  const filtersParam = url.searchParams.get("filters");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25")));

  // Legacy path — no filters param, return simple array (Kanban + admin pages)
  if (!filtersParam) {
    if (role === "ADMIN") {
      const leads = await prisma.lead.findMany({
        include: { agent: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(leads);
    }
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json([]);
    const leads = await prisma.lead.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leads);
  }

  // Filtered + paginated path
  let filters: FilterCondition[] = [];
  try {
    filters = JSON.parse(filtersParam);
    if (!Array.isArray(filters)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  }

  let agentId: string | null = null;
  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json({ leads: [], total: 0, page, pageSize });
    agentId = agent.id;
  }

  const where = buildLeadWhere(filters, agentId);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        source: true,
        priceMin: true,
        priceMax: true,
        lastContactedAt: true,
        tags: { select: { tag: { select: { name: true, color: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pageSize });
}
```

The full updated file (POST handler unchanged, new GET handler added):

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendLeadNotification } from "@/lib/email";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { applyTag } from "@/lib/tags";
import { buildLeadWhere, FilterCondition } from "@/lib/smart-list-filters";

const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
});

// Public — no auth required.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  const { success, reset } = await publicFormRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const lead = await prisma.lead.create({ data });
    sendLeadNotification(lead).catch(console.error);
    if (data.source === "OPEN_HOUSE") {
      applyTag(lead.id, "Open House").catch(console.error);
    }
    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Agents see their own leads; ADMIN sees all.
export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;
  const url = new URL(req.url);
  const filtersParam = url.searchParams.get("filters");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25")));

  if (!filtersParam) {
    if (role === "ADMIN") {
      const leads = await prisma.lead.findMany({
        include: { agent: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(leads);
    }
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json([]);
    const leads = await prisma.lead.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leads);
  }

  let filters: FilterCondition[] = [];
  try {
    filters = JSON.parse(filtersParam);
    if (!Array.isArray(filters)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  }

  let agentId: string | null = null;
  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json({ leads: [], total: 0, page, pageSize });
    agentId = agent.id;
  }

  const where = buildLeadWhere(filters, agentId);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        source: true,
        priceMin: true,
        priceMax: true,
        lastContactedAt: true,
        tags: { select: { tag: { select: { name: true, color: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pageSize });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
cd apps/web && npx tsc --noEmit 2>&1 | grep "smart-list-filters\|leads/route"
```

Expected: no errors from those files.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/leads/route.ts
git commit -m "feat(api): add filter and pagination support to GET /api/leads"
```

---

### Task 5: SmartListSidebar component

**Files:**
- Create: `apps/web/src/components/leads/SmartListSidebar.tsx`

**Interfaces:**
- Consumes: `PREBUILT_LISTS` from `@/lib/smart-list-filters`; `SmartListDrawer` from `./SmartListDrawer`
- Produces: `SmartListSidebar` component with props:
  ```ts
  type Props = { customLists: Array<{ id: string; name: string; filters: unknown }> }
  ```
  Uses `useSearchParams` / `useRouter` to read and update `?list=` param.

- [ ] **Step 1: Create `apps/web/src/components/leads/SmartListSidebar.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PREBUILT_LISTS, FilterCondition } from "@/lib/smart-list-filters";
import { SmartListDrawer } from "./SmartListDrawer";

type CustomList = { id: string; name: string; filters: unknown };

type Props = {
  customLists: CustomList[];
};

export function SmartListSidebar({ customLists: initialLists }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("list");

  const [lists, setLists] = useState<CustomList[]>(initialLists);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingList, setEditingList] = useState<CustomList | null>(null);

  function selectList(slug: string | null) {
    router.push(slug ? `/dashboard/leads?list=${slug}` : "/dashboard/leads");
  }

  function openCreate() {
    setEditingList(null);
    setDrawerOpen(true);
  }

  function openEdit(list: CustomList) {
    setEditingList(list);
    setDrawerOpen(true);
  }

  function handleSaved(list: CustomList) {
    setLists(prev => {
      const idx = prev.findIndex(l => l.id === list.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = list;
        return next;
      }
      return [...prev, list];
    });
    setDrawerOpen(false);
    selectList(list.id);
  }

  function handleDeleted(id: string) {
    setLists(prev => prev.filter(l => l.id !== id));
    if (selected === id) selectList(null);
    setDrawerOpen(false);
  }

  function linkClass(isSelected: boolean) {
    return `block w-full rounded-lg px-3 py-1.5 text-left font-sans text-sm transition-colors ${
      isSelected
        ? "bg-[#9E8C61]/10 font-medium text-[#9E8C61]"
        : "font-light text-[#1B1B1B]/60 hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
    }`;
  }

  return (
    <>
      <div className="flex w-48 flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-3 py-6">
        <button onClick={() => selectList(null)} className={linkClass(!selected)}>
          Kanban
        </button>

        <div className="mt-4">
          <p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">
            Smart Lists
          </p>
          {PREBUILT_LISTS.map(list => (
            <button
              key={list.slug}
              onClick={() => selectList(list.slug)}
              className={linkClass(selected === list.slug)}
            >
              {list.name}
            </button>
          ))}
        </div>

        {lists.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">
              My Lists
            </p>
            {lists.map(list => (
              <div key={list.id} className="group relative flex items-center">
                <button
                  onClick={() => selectList(list.id)}
                  className={`${linkClass(selected === list.id)} flex-1 truncate pr-8`}
                >
                  {list.name}
                </button>
                <button
                  onClick={() => openEdit(list)}
                  className="absolute right-1 hidden rounded p-1 font-sans text-xs text-[#1B1B1B]/30 hover:text-[#1B1B1B] group-hover:block"
                  title="Edit list"
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={openCreate}
          className="mt-4 w-full rounded-lg border border-dashed border-[#1B1B1B]/20 px-3 py-1.5 text-left font-sans text-sm text-[#1B1B1B]/40 transition-colors hover:border-[#9E8C61]/40 hover:text-[#9E8C61]"
        >
          + New List
        </button>
      </div>

      {drawerOpen && (
        <SmartListDrawer
          list={editingList}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit (SmartListDrawer doesn't exist yet — TypeScript will error; commit after Task 7 instead)**

Hold this file — commit together with SmartListDrawer in Task 7.

---

### Task 6: SmartListResults component

**Files:**
- Create: `apps/web/src/components/leads/SmartListResults.tsx`

**Interfaces:**
- Consumes: `FilterCondition` from `@/lib/smart-list-filters`; `LEAD_STATUS_COLORS` from `@/lib/campaign-ui`
- Produces: `SmartListResults` component with props:
  ```ts
  type Props = { listName: string; filters: FilterCondition[] }
  ```

- [ ] **Step 1: Create `apps/web/src/components/leads/SmartListResults.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEAD_STATUS_COLORS } from "@/lib/campaign-ui";
import type { FilterCondition } from "@/lib/smart-list-filters";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  HOT_PROSPECT: "Hot Prospect", NURTURE: "Nurture", SHOWING: "Showing",
  OFFER: "Offer", UNDER_CONTRACT: "Under Contract", CLOSED: "Past Client",
  LOST: "Dead Lead", SPHERE: "Sphere",
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website", REFERRAL: "Referral", SOCIAL: "Social",
  OPEN_HOUSE: "Open House", COLD_CALL: "Cold Call", OTHER: "Other",
};

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  source: string;
  priceMin: number | null;
  priceMax: number | null;
  lastContactedAt: string | null;
  tags: Array<{ tag: { name: string; color: string } }>;
};

type Props = {
  listName: string;
  filters: FilterCondition[];
};

const PAGE_SIZE = 25;

function formatLastContacted(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

export function SmartListResults({ listName, filters }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    fetch(`/api/leads?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">{listName}</h1>
        {!loading && (
          <p className="font-sans text-sm text-[#1B1B1B]/40">{total} lead{total !== 1 ? "s" : ""}</p>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center font-sans text-sm text-[#1B1B1B]/40">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center">
          <p className="font-sans text-sm text-[#1B1B1B]/50">No leads match this list</p>
          <p className="mt-1 font-sans text-xs text-[#1B1B1B]/30">
            Leads appear here automatically as they meet the filter criteria
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1B1B1B]/10">
                  {["Name", "Status", "Tags", "Last Contacted", "Source", "Price Range"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/40">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.id} className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="font-sans text-sm text-[#1B1B1B] hover:text-[#9E8C61]"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 font-sans text-xs font-medium ${LEAD_STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map(t => (
                          <span
                            key={t.tag.name}
                            className="inline-flex rounded-full px-2 py-0.5 font-sans text-xs font-medium text-white"
                            style={{ backgroundColor: t.tag.color }}
                          >
                            {t.tag.name}
                          </span>
                        ))}
                        {lead.tags.length > 3 && (
                          <span className="font-sans text-xs text-[#1B1B1B]/40">
                            +{lead.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#1B1B1B]/60">
                      {formatLastContacted(lead.lastContactedAt)}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#1B1B1B]/60">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#1B1B1B]/60">
                      {formatPrice(lead.priceMin, lead.priceMax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B] disabled:opacity-30"
              >
                ← Previous
              </button>
              <span className="font-sans text-sm text-[#1B1B1B]/40">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B] disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/leads/SmartListResults.tsx
git commit -m "feat(ui): add SmartListResults paginated lead table"
```

---

### Task 7: SmartListDrawer component

**Files:**
- Create: `apps/web/src/components/leads/SmartListDrawer.tsx`

**Interfaces:**
- Consumes: `FilterCondition` from `@/lib/smart-list-filters`; `GET /api/tags`; `POST/PATCH /api/smart-lists`; `DELETE /api/smart-lists/[id]`
- Produces: `SmartListDrawer` component with props:
  ```ts
  type Props = {
    list: { id: string; name: string; filters: unknown } | null; // null = create mode
    onClose: () => void;
    onSaved: (list: { id: string; name: string; filters: unknown }) => void;
    onDeleted: (id: string) => void;
  }
  ```

- [ ] **Step 1: Create `apps/web/src/components/leads/SmartListDrawer.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { FilterCondition } from "@/lib/smart-list-filters";

const STATUSES = [
  { value: "NEW", label: "New" }, { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" }, { value: "HOT_PROSPECT", label: "Hot Prospect" },
  { value: "NURTURE", label: "Nurture" }, { value: "SHOWING", label: "Showing" },
  { value: "OFFER", label: "Offer" }, { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "CLOSED", label: "Past Client" }, { value: "LOST", label: "Dead Lead" },
  { value: "SPHERE", label: "Sphere" },
];

const SOURCES = [
  { value: "WEBSITE", label: "Website" }, { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL", label: "Social" }, { value: "OPEN_HOUSE", label: "Open House" },
  { value: "COLD_CALL", label: "Cold Call" }, { value: "OTHER", label: "Other" },
];

const TIMEFRAMES = ["0-3 months", "3-6 months", "6-12 months", "12+ months", "Unknown"];

const FIELDS = [
  { value: "status", label: "Status" },
  { value: "tags", label: "Tags" },
  { value: "lastContacted", label: "Last Contacted" },
  { value: "timeframe", label: "Timeframe to Move" },
  { value: "source", label: "Source" },
  { value: "priceMin", label: "Min Budget" },
  { value: "priceMax", label: "Max Budget" },
  { value: "hasPendingTask", label: "Has Pending Task" },
  { value: "createdDate", label: "Created Date" },
];

const FIELD_OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  status:         [{ value: "is", label: "is" }, { value: "isNot", label: "is not" }],
  tags:           [{ value: "hasAnyOf", label: "has any of" }, { value: "hasNoneOf", label: "has none of" }],
  lastContacted:  [{ value: "moreThan", label: "more than X days ago" }, { value: "lessThan", label: "less than X days ago" }, { value: "never", label: "never contacted" }],
  timeframe:      [{ value: "is", label: "is" }],
  source:         [{ value: "is", label: "is" }, { value: "isNot", label: "is not" }],
  priceMin:       [{ value: "atLeast", label: "at least $" }],
  priceMax:       [{ value: "atMost", label: "at most $" }],
  hasPendingTask: [{ value: "is", label: "is" }],
  createdDate:    [{ value: "withinLast", label: "within last X days" }, { value: "moreThan", label: "more than X days ago" }],
};

function defaultOperator(field: string): string {
  return FIELD_OPERATORS[field]?.[0]?.value ?? "is";
}

function defaultValue(field: string, operator: string): unknown {
  if (field === "status" || field === "source" || field === "tags") return [];
  if (field === "hasPendingTask") return true;
  if (field === "lastContacted" && operator === "never") return null;
  if (field === "timeframe") return TIMEFRAMES[0];
  return 30;
}

type ConditionRow = { field: string; operator: string; value: unknown };

type Props = {
  list: { id: string; name: string; filters: unknown } | null;
  onClose: () => void;
  onSaved: (list: { id: string; name: string; filters: unknown }) => void;
  onDeleted: (id: string) => void;
};

export function SmartListDrawer({ list, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(list?.name ?? "");
  const [conditions, setConditions] = useState<ConditionRow[]>(() => {
    if (!list?.filters) return [];
    try { return (list.filters as FilterCondition[]).map(f => ({ ...f })); }
    catch { return []; }
  });
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch("/api/tags").then(r => r.json()).then(setTags).catch(() => {});
  }, []);

  function addCondition() {
    const field = "status";
    const operator = defaultOperator(field);
    setConditions(prev => [...prev, { field, operator, value: defaultValue(field, operator) }]);
  }

  function updateField(i: number, field: string) {
    const operator = defaultOperator(field);
    setConditions(prev => prev.map((c, idx) => idx === i ? { field, operator, value: defaultValue(field, operator) } : c));
  }

  function updateOperator(i: number, operator: string) {
    setConditions(prev => prev.map((c, idx) => {
      if (idx !== i) return c;
      const value = (c.field === "lastContacted" && operator === "never") ? null : (typeof c.value === "number" ? c.value : defaultValue(c.field, operator));
      return { ...c, operator, value };
    }));
  }

  function updateValue(i: number, value: unknown) {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, value } : c));
  }

  function removeCondition(i: number) {
    setConditions(prev => prev.filter((_, idx) => idx !== i));
  }

  function toggleArrayValue(i: number, val: string) {
    setConditions(prev => prev.map((c, idx) => {
      if (idx !== i) return c;
      const arr = Array.isArray(c.value) ? c.value as string[] : [];
      const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
      return { ...c, value: next };
    }));
  }

  async function handleSave() {
    if (!name.trim() || conditions.length === 0) return;
    setSaving(true);
    try {
      const url = list ? `/api/smart-lists/${list.id}` : "/api/smart-lists";
      const method = list ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filters: conditions }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!list) return;
    setDeleting(true);
    try {
      await fetch(`/api/smart-lists/${list.id}`, { method: "DELETE" });
      onDeleted(list.id);
    } finally {
      setDeleting(false);
    }
  }

  function renderValueInput(condition: ConditionRow, i: number) {
    const { field, operator, value } = condition;

    if (field === "lastContacted" && operator === "never") return null;

    if (field === "status") {
      return (
        <div className="max-h-40 overflow-y-auto rounded border border-[#1B1B1B]/10 p-2">
          {STATUSES.map(s => (
            <label key={s.value} className="flex cursor-pointer items-center gap-2 rounded py-0.5 px-1 hover:bg-[#F2F0EF]">
              <input
                type="checkbox"
                checked={Array.isArray(value) && (value as string[]).includes(s.value)}
                onChange={() => toggleArrayValue(i, s.value)}
                className="accent-[#9E8C61]"
              />
              <span className="font-sans text-sm text-[#1B1B1B]">{s.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field === "source") {
      return (
        <div className="rounded border border-[#1B1B1B]/10 p-2">
          {SOURCES.map(s => (
            <label key={s.value} className="flex cursor-pointer items-center gap-2 rounded py-0.5 px-1 hover:bg-[#F2F0EF]">
              <input
                type="checkbox"
                checked={Array.isArray(value) && (value as string[]).includes(s.value)}
                onChange={() => toggleArrayValue(i, s.value)}
                className="accent-[#9E8C61]"
              />
              <span className="font-sans text-sm text-[#1B1B1B]">{s.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field === "tags") {
      return (
        <div className="max-h-40 overflow-y-auto rounded border border-[#1B1B1B]/10 p-2">
          {tags.length === 0 && <p className="font-sans text-xs text-[#1B1B1B]/40">No tags yet</p>}
          {tags.map(t => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded py-0.5 px-1 hover:bg-[#F2F0EF]">
              <input
                type="checkbox"
                checked={Array.isArray(value) && (value as string[]).includes(t.name)}
                onChange={() => toggleArrayValue(i, t.name)}
                className="accent-[#9E8C61]"
              />
              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              <span className="font-sans text-sm text-[#1B1B1B]">{t.name}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field === "timeframe") {
      return (
        <select
          value={value as string}
          onChange={e => updateValue(i, e.target.value)}
          className="w-full rounded border border-[#1B1B1B]/10 bg-white px-3 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
        >
          {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    }

    if (field === "hasPendingTask") {
      return (
        <select
          value={String(value)}
          onChange={e => updateValue(i, e.target.value === "true")}
          className="w-full rounded border border-[#1B1B1B]/10 bg-white px-3 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    // Number input (lastContacted days, priceMin, priceMax, createdDate)
    return (
      <input
        type="number"
        value={value as number ?? ""}
        onChange={e => updateValue(i, Number(e.target.value))}
        min={0}
        className="w-full rounded border border-[#1B1B1B]/10 bg-white px-3 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
        placeholder={field === "priceMin" || field === "priceMax" ? "e.g. 500000" : "e.g. 30"}
      />
    );
  }

  const canSave = name.trim().length > 0 && conditions.length > 0 && !saving;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-96 flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">
            {list ? "Edit List" : "New Smart List"}
          </h2>
          <button onClick={onClose} className="font-sans text-xl text-[#1B1B1B]/30 hover:text-[#1B1B1B]">×</button>
        </div>

        <div className="flex-1 space-y-6 p-6">
          <div>
            <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/40">
              List Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Buyers in Irvine"
              className="w-full rounded border border-[#1B1B1B]/10 bg-white px-3 py-2 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
            />
          </div>

          <div>
            <label className="mb-2 block font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/40">
              Filters <span className="normal-case text-[#1B1B1B]/30">(all must match)</span>
            </label>
            <div className="space-y-3">
              {conditions.map((c, i) => (
                <div key={i} className="rounded-lg border border-[#1B1B1B]/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={c.field}
                      onChange={e => updateField(i, e.target.value)}
                      className="flex-1 rounded border border-[#1B1B1B]/10 bg-white px-2 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
                    >
                      {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <button
                      onClick={() => removeCondition(i)}
                      className="flex-shrink-0 font-sans text-lg text-[#1B1B1B]/30 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                  {FIELD_OPERATORS[c.field]?.length > 1 && (
                    <select
                      value={c.operator}
                      onChange={e => updateOperator(i, e.target.value)}
                      className="w-full rounded border border-[#1B1B1B]/10 bg-white px-2 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
                    >
                      {FIELD_OPERATORS[c.field].map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  )}
                  {renderValueInput(c, i)}
                </div>
              ))}
            </div>
            <button
              onClick={addCondition}
              className="mt-3 w-full rounded-lg border border-dashed border-[#1B1B1B]/20 px-3 py-2 font-sans text-sm text-[#1B1B1B]/40 hover:border-[#9E8C61]/40 hover:text-[#9E8C61]"
            >
              + Add Filter
            </button>
          </div>
        </div>

        <div className="border-t border-[#1B1B1B]/10 p-6 space-y-3">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-lg bg-[#1B1B1B] px-4 py-2 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            {saving ? "Saving…" : list ? "Save Changes" : "Create List"}
          </button>
          {list && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-lg border border-red-200 px-4 py-2 font-sans text-sm text-red-500 hover:bg-red-50"
            >
              Delete List
            </button>
          )}
          {list && confirmDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full rounded-lg bg-red-500 px-4 py-2 font-sans text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Now commit SmartListSidebar + SmartListDrawer together**

```bash
git add apps/web/src/components/leads/SmartListSidebar.tsx apps/web/src/components/leads/SmartListDrawer.tsx
git commit -m "feat(ui): add SmartListSidebar and SmartListDrawer filter builder"
```

---

### Task 8: Leads page wiring — 3-column layout + URL state

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx`

**Interfaces:**
- Consumes: `SmartListSidebar` from `@/components/leads/SmartListSidebar`; `SmartListResults` from `@/components/leads/SmartListResults`; `PREBUILT_LISTS`, `resolveListFilters` from `@/lib/smart-list-filters`; `LeadKanban` from `@/components/dashboard/LeadKanban`; `prisma` from `@/lib/prisma`

- [ ] **Step 1: Replace `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadKanban } from "@/components/dashboard/LeadKanban";
import { SmartListSidebar } from "@/components/leads/SmartListSidebar";
import { SmartListResults } from "@/components/leads/SmartListResults";
import { PREBUILT_LISTS, resolveListFilters } from "@/lib/smart-list-filters";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { list?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  const agent = role !== "ADMIN"
    ? await prisma.agent.findUnique({ where: { userId } })
    : null;

  const customLists = agent
    ? await prisma.smartList.findMany({
        where: { agentId: agent.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, filters: true },
      })
    : [];

  const selectedList = searchParams.list ?? null;
  const selectedFilters = resolveListFilters(selectedList, customLists);
  const selectedName =
    PREBUILT_LISTS.find(l => l.slug === selectedList)?.name ??
    customLists.find(l => l.id === selectedList)?.name ??
    "";

  let kanbanLeads: {
    id: string; firstName: string; lastName: string;
    email: string; phone: string | null; status: string; createdAt: string;
  }[] = [];

  if (!selectedList) {
    try {
      const leads = await prisma.lead.findMany({
        where: agent ? { agentId: agent.id } : {},
        orderBy: { createdAt: "desc" },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, createdAt: true },
      });
      kanbanLeads = leads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() }));
    } catch {
      // DB error — show empty Kanban
    }
  }

  return (
    <div className="-m-8 flex min-h-[calc(100vh-4rem)]">
      <SmartListSidebar customLists={customLists.map(l => ({ id: l.id, name: l.name, filters: l.filters }))} />

      <div className="flex-1 overflow-auto p-8">
        {!selectedList || !selectedFilters ? (
          <>
            <div className="mb-8">
              <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Leads</h1>
            </div>
            <LeadKanban initialLeads={kanbanLeads} />
          </>
        ) : (
          <SmartListResults listName={selectedName} filters={selectedFilters} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page builds without TypeScript errors**

```
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "leads/page\|SmartList\|smart-list"
```

Expected: no errors from those files.

- [ ] **Step 3: Manual test in browser**

Start the dev server (`pnpm dev`) and verify:

1. `localhost:3000/dashboard/leads` — shows Kanban sidebar on left, Kanban board on right. All 5 pre-built lists appear in sidebar under "Smart Lists".
2. Click "Hot Prospects" → URL becomes `?list=hot-prospects`, main area shows table with count.
3. Click "Kanban" → returns to Kanban board.
4. Click "+ New List" → drawer slides in from right.
5. Enter a name, add a Status filter (select HOT_PROSPECT), click "Create List" → list appears in "My Lists", view switches to results.
6. Hover over the custom list → edit pencil icon appears. Click it → drawer opens with existing name/filters pre-populated.
7. Click "Delete List" → confirm prompt → list removed, view returns to Kanban.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/leads/page.tsx"
git commit -m "feat(leads): 3-column layout with Smart List sidebar and URL state"
```
