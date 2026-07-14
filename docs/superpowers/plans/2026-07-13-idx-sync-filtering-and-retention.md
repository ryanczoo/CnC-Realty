# IDX Sync Filtering & Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the IDX sync to the statuses the app actually uses, and cap
storage growth for historical closed sales while keeping Price History
complete.

**Architecture:** Two independent changes, both landing in the sync path
(`apps/web/src/lib/idx/client.ts` and `apps/web/src/app/api/idx/sync/route.ts`):
a CRMLS-side `$filter` restricting which statuses we fetch at all, and a
per-record decision at upsert time that (a) skips closed-rental records
entirely and (b) writes a lightweight (no photos/details JSON) record for
closed sales older than 1 year.

**Tech Stack:** Next.js API routes, Prisma, Vitest.

## Global Constraints

- Status filter keeps exactly these `StandardStatus` values:
  `Active`, `ComingSoon`, `ActiveUnderContract`, `Closed`.
- `Closed` records are only ever upserted when `listingType === "FOR_SALE"`
  — closed `FOR_RENT` records are skipped entirely, not stored at all.
- "Older than 1 year" for the retention split means
  `Date.now() - closeDate.getTime() > 365 * 24 * 60 * 60 * 1000`, evaluated
  at upsert time only (no periodic re-sweep — documented limitation, see
  `docs/superpowers/specs/2026-07-13-price-history-retention-design.md`).
- Lightweight records set `photos: []` (schema default, not nullable) and
  `details: null` (schema is `Json?`, nullable) — every other field is
  written normally.
- No geographic filter of any kind — CnC syncs statewide.

---

### Task 1: Status filter on the CRMLS query

**Files:**
- Modify: `apps/web/src/lib/idx/client.ts:38-41`
- Test: `apps/web/src/__tests__/lib/idx/client.test.ts` (new file)

**Interfaces:**
- Produces: `buildPropertyFilter(modifiedSince?: Date): string` — exported
  pure function, used internally by `fetchProperties`. Later tasks in this
  plan do not depend on this function directly.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/idx/client.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildPropertyFilter } from "@/lib/idx/client";

describe("buildPropertyFilter", () => {
  it("includes the status filter with no ModificationTimestamp clause when modifiedSince is omitted", () => {
    expect(buildPropertyFilter()).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')&"
    );
  });

  it("combines the status filter with a ModificationTimestamp clause when modifiedSince is given", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    expect(buildPropertyFilter(since)).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ModificationTimestamp gt 2026-07-01T00:00:00.000Z&"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/idx/client.test.ts`
Expected: FAIL with `buildPropertyFilter is not a function` (or similar —
the export doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/idx/client.ts`, the current lines 38-41 are:

```typescript
export async function* fetchProperties(modifiedSince?: Date) {
  let token = await getResoToken();
  const filter = modifiedSince ? `$filter=ModificationTimestamp gt ${modifiedSince.toISOString()}&` : "";
  let url: string | null = `${BASE_URL}/Property?${filter}$top=200&$select=${SELECT_FIELDS}&$expand=Media($select=MediaURL,Order)`;
```

Replace with:

```typescript
const STATUS_FILTER = "StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')";

export function buildPropertyFilter(modifiedSince?: Date): string {
  const clauses = [STATUS_FILTER];
  if (modifiedSince) {
    clauses.push(`ModificationTimestamp gt ${modifiedSince.toISOString()}`);
  }
  return `$filter=${clauses.join(" and ")}&`;
}

export async function* fetchProperties(modifiedSince?: Date) {
  let token = await getResoToken();
  const filter = buildPropertyFilter(modifiedSince);
  let url: string | null = `${BASE_URL}/Property?${filter}$top=200&$select=${SELECT_FIELDS}&$expand=Media($select=MediaURL,Order)`;
```

Place the new `STATUS_FILTER` constant and `buildPropertyFilter` function
directly above `fetchProperties` (after the existing `ODataResponse`
interface, before `export async function* fetchProperties`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/idx/client.test.ts`
Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/idx/client.ts apps/web/src/__tests__/lib/idx/client.test.ts
git commit -m "feat: scope IDX sync to Active/ComingSoon/ActiveUnderContract/Closed statuses"
```

---

### Task 2: Skip closed-rental records in the sync upsert loop

**Files:**
- Modify: `apps/web/src/app/api/idx/sync/route.ts`
- Test: `apps/web/src/__tests__/api/idx-sync.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new from Task 1 — independent of `buildPropertyFilter`.
- Produces: no new exports; behavior change only (closed-rental records are
  never passed to `prisma.property.upsert`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/api/idx-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { upsert: vi.fn() } },
}));
vi.mock("@/lib/idx/client", () => ({
  fetchProperties: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";
import { GET } from "../../app/api/idx/sync/route";

function makeRequest(secret: string) {
  return new Request("http://localhost/api/idx/sync?type=delta", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/idx/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("skips upserting a Closed FOR_RENT record but keeps Active FOR_RENT and Closed FOR_SALE", async () => {
    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield [
        { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" } as any,
        { mlsNumber: "ML2", status: "Active", listingType: "FOR_RENT" } as any,
        { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE" } as any,
      ];
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upserted).toBe(2);

    expect(prisma.property.upsert).toHaveBeenCalledTimes(2);
    const upsertedIds = vi.mocked(prisma.property.upsert).mock.calls.map(
      (call) => (call[0] as any).where.mlsNumber
    );
    expect(upsertedIds).toEqual(["ML2", "ML3"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/idx-sync.test.ts`
Expected: FAIL — `prisma.property.upsert` called 3 times, not 2 (ML1 isn't
skipped yet).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/app/api/idx/sync/route.ts`, the current loop (lines 18-32) is:

```typescript
  for await (const batch of fetchProperties(modifiedSince)) {
    for (const property of batch) {
      try {
        await prisma.property.upsert({
          where: { mlsNumber: property.mlsNumber },
          create: property,
          update: property,
        });
        upserted++;
      } catch (err) {
        console.error("Upsert failed for", property.mlsNumber, err);
        errors++;
      }
    }
  }
```

Replace with:

```typescript
  for await (const batch of fetchProperties(modifiedSince)) {
    for (const property of batch) {
      if (property.status === "Closed" && property.listingType === "FOR_RENT") continue;
      try {
        await prisma.property.upsert({
          where: { mlsNumber: property.mlsNumber },
          create: property,
          update: property,
        });
        upserted++;
      } catch (err) {
        console.error("Upsert failed for", property.mlsNumber, err);
        errors++;
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/idx-sync.test.ts`
Expected: PASS, 1/1 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/idx/sync/route.ts apps/web/src/__tests__/api/idx-sync.test.ts
git commit -m "feat: skip closed rental listings in the IDX sync upsert loop"
```

---

### Task 3: Two-tier retention — lightweight records for closed sales older than 1 year

**Files:**
- Modify: `apps/web/src/app/api/idx/sync/route.ts`
- Modify: `apps/web/src/__tests__/api/idx-sync.test.ts`

**Interfaces:**
- Consumes: the file state left by Task 2 (the `continue` skip-check must
  already be in place — this task adds to the same loop, not a fresh copy).
- Produces: no new exports; behavior change only (old closed sales get
  `photos: []`, `details: null` at write time).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/api/idx-sync.test.ts` (same `describe` block,
new `it`):

```typescript
  it("writes a lightweight record (no photos/details) for closed sales older than 1 year, full record otherwise", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00.000Z"));

    const withinYear = new Date("2026-01-01T00:00:00.000Z");
    const overYearAgo = new Date("2025-01-01T00:00:00.000Z");

    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield [
        { mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE", closeDate: null, photos: ["a.jpg"], details: { Roof: "Tile" } } as any,
        { mlsNumber: "ML2", status: "Closed", listingType: "FOR_SALE", closeDate: withinYear, photos: ["b.jpg"], details: { Roof: "Shingle" } } as any,
        { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE", closeDate: overYearAgo, photos: ["c.jpg"], details: { Roof: "Metal" } } as any,
      ];
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);

    const calls = vi.mocked(prisma.property.upsert).mock.calls;
    const byId = Object.fromEntries(calls.map((call) => [(call[0] as any).where.mlsNumber, (call[0] as any).create]));

    expect(byId.ML1.photos).toEqual(["a.jpg"]);
    expect(byId.ML1.details).toEqual({ Roof: "Tile" });
    expect(byId.ML2.photos).toEqual(["b.jpg"]);
    expect(byId.ML2.details).toEqual({ Roof: "Shingle" });
    expect(byId.ML3.photos).toEqual([]);
    expect(byId.ML3.details).toBeNull();

    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/idx-sync.test.ts`
Expected: FAIL — `ML3.photos` is `["c.jpg"]`, not `[]` (no lightweight
logic yet).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/app/api/idx/sync/route.ts`, add a helper above `runSync`
(after the imports, before `export const maxDuration = 300;` or directly
above `async function runSync`):

```typescript
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function isOldClosedSale(property: { status: string; closeDate: Date | null }): boolean {
  if (property.status !== "Closed" || !property.closeDate) return false;
  return Date.now() - property.closeDate.getTime() > ONE_YEAR_MS;
}
```

Then update the loop body (the one Task 2 already modified) from:

```typescript
      if (property.status === "Closed" && property.listingType === "FOR_RENT") continue;
      try {
        await prisma.property.upsert({
          where: { mlsNumber: property.mlsNumber },
          create: property,
          update: property,
        });
```

to:

```typescript
      if (property.status === "Closed" && property.listingType === "FOR_RENT") continue;
      const payload = isOldClosedSale(property)
        ? { ...property, photos: [], details: null }
        : property;
      try {
        await prisma.property.upsert({
          where: { mlsNumber: payload.mlsNumber },
          create: payload,
          update: payload,
        });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/idx-sync.test.ts`
Expected: PASS, 2/2 tests.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `pnpm --filter web exec vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/idx/sync/route.ts apps/web/src/__tests__/api/idx-sync.test.ts
git commit -m "feat: write lightweight records for closed sales older than 1 year"
```
