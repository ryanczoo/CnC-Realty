# Home Value Estimator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-house, free "instant home value" tool — a teaser section on `/sell` that routes to a `/home-value` report page showing a comps-based value range, comparable sold listings, price history, and a local market snapshot, with the single precise point estimate gated behind a lead-capture form.

**Architecture:** A pure calculation module (`home-value-estimate.ts`) computes a median-$/sqft estimate from sold comps pulled out of our own `Property` table (CRMLS data already in the DB). Two API routes wrap it: `GET /api/home-value/estimate` (public data, no point estimate) and `POST /api/home-value/reveal` (creates a `Lead`, returns the point estimate). Client-side Mapbox Geocoding resolves addresses to lat/long/zip; DB address matching finds subject property facts and price history.

**Tech Stack:** Next.js 14 App Router, Prisma/PostgreSQL, Zod validation, Vitest, existing Mapbox Geocoding (client-side, `NEXT_PUBLIC_MAPBOX_TOKEN`), existing `@upstash/ratelimit` (`publicFormRateLimit`).

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-07-08-home-value-estimator-design.md`
- Gate scope: only the precise point-estimate number requires signup. Range, comps, price history, and market snapshot are all free — enforced by never including `pointEstimate` in the `GET /api/home-value/estimate` response.
- Comps use `closePrice`/`closeDate` (real sold price), not `listPrice` — these two fields must be added to the IDX sync before any comps logic is written.
- Comps matching is **zip-exact**, not a lat/long radius (a documented simplification of the spec's "same ZIP or small lat/long bounding box" — zip alone is sufficient and avoids adding geo-distance math).
- Estimate method: median $/sqft of matched sold comps × subject sqft, range from the comps' 25th–75th percentile $/sqft. No ML/regression.
- New Prisma migrations on this machine can EPERM if the dev server is running (it locks `query_engine-windows.dll.node`). Stop the dev server before any `prisma migrate dev` / `prisma generate`, restart it after.
- Follow existing repo conventions found during planning: Zod schemas + `z.ZodError` handling matching `apps/web/src/app/api/leads/route.ts`; `publicFormRateLimit` for public POST routes; pure logic extracted and unit-tested the way `getSlideState` is extracted from `RentCitiesSlider.tsx`.

---

## Task 1: Schema — `closePrice`/`closeDate` on `Property`, `HOME_VALUATION` lead source

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `Property.closePrice: Float | null`, `Property.closeDate: DateTime | null`, `LeadSource.HOME_VALUATION` — consumed by Tasks 2, 5, 6, 8.

- [ ] **Step 1: Add the two fields to the `Property` model**

In `packages/database/prisma/schema.prisma`, find the `Property` model (starts at the line `model Property {`) and add these two fields directly under `listOfficeName`:

```prisma
  listOfficeName     String?
  closePrice         Float?
  closeDate          DateTime?
  details            Json?
```

(i.e. insert `closePrice` and `closeDate` between the existing `listOfficeName` and `details` lines.)

Also add an index for the comps query, alongside the existing `@@index` lines at the bottom of the model:

```prisma
  @@index([status, zip, closeDate])
```

- [ ] **Step 2: Add `HOME_VALUATION` to the `LeadSource` enum**

Find `enum LeadSource {` and add the new value before `OTHER`:

```prisma
enum LeadSource {
  WEBSITE
  REFERRAL
  SOCIAL
  OPEN_HOUSE
  COLD_CALL
  HOME_VALUATION
  OTHER
}
```

- [ ] **Step 3: Stop the dev server**

If a dev server is running in the background, stop it (Ctrl+C in its terminal, or run `taskkill //F //IM node.exe` from Bash on this machine). This avoids the documented Windows EPERM lock on `query_engine-windows.dll.node` during `prisma generate`.

- [ ] **Step 4: Run the migration**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty" && pnpm --filter @cnc/database exec prisma migrate dev --name add_property_close_price_and_home_valuation_source
```

Expected: prompts complete without error, prints a new migration folder name under `packages/database/prisma/migrations/`, ends with "Your database is now in sync with your schema" and generates the Prisma Client.

- [ ] **Step 5: Restart the dev server**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty" && pnpm --filter web dev
```

(Run in background / a separate terminal — later tasks need it running to smoke-test.)

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add Property.closePrice/closeDate and HOME_VALUATION lead source"
```

---

## Task 2: IDX sync — pull `ClosePrice`/`CloseDate` from CRMLS

**Files:**
- Modify: `apps/web/src/lib/idx/client.ts`
- Modify: `apps/web/src/lib/idx/field-map.ts`
- Test: `apps/web/src/__tests__/lib/field-map.test.ts` (new)

**Interfaces:**
- Consumes: `Property.closePrice`/`closeDate` from Task 1.
- Produces: `mapResoToProperty()` now returns `closePrice: number | null` and `closeDate: Date | null` — consumed by nothing directly in this plan (it feeds the IDX sync pipeline, which populates the DB rows Tasks 5/6 query), but the field names must match exactly.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/field-map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapResoToProperty } from "@/lib/idx/field-map";

function baseRaw() {
  return {
    ListingKey: "ML123",
    StandardStatus: "Closed",
    ListPrice: 1000000,
    StreetNumber: "123",
    StreetName: "Main",
    StreetSuffix: "St",
    City: "Pasadena",
    PostalCode: "91101",
  };
}

describe("mapResoToProperty — ClosePrice/CloseDate", () => {
  it("maps ClosePrice to closePrice", () => {
    const result = mapResoToProperty({ ...baseRaw(), ClosePrice: 985000 } as any);
    expect(result.closePrice).toBe(985000);
  });

  it("maps CloseDate to a closeDate Date object", () => {
    const result = mapResoToProperty({ ...baseRaw(), CloseDate: "2026-05-10" } as any);
    expect(result.closeDate).toBeInstanceOf(Date);
    expect(result.closeDate?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  it("defaults closePrice and closeDate to null when absent", () => {
    const result = mapResoToProperty(baseRaw() as any);
    expect(result.closePrice).toBeNull();
    expect(result.closeDate).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/field-map.test.ts
```

Expected: FAIL — `result.closePrice` is `undefined`, not `985000`/`null` (property doesn't exist on the returned object yet).

- [ ] **Step 3: Add the fields to `ResoProperty` and `SELECT_FIELDS`**

In `apps/web/src/lib/idx/client.ts`, add `"ClosePrice", "CloseDate"` to the `SELECT_FIELDS` array, in the "Core listing fields" group:

```ts
  "ListingKey", "StandardStatus", "ListPrice", "ClosePrice", "CloseDate",
```

(replaces the existing `"ListingKey", "StandardStatus", "ListPrice",` line)

- [ ] **Step 4: Map the fields in `field-map.ts`**

In `apps/web/src/lib/idx/field-map.ts`, add to the `ResoProperty` interface, near `ListPrice?: number;`:

```ts
  ListPrice?: number;
  ClosePrice?: number;
  CloseDate?: string;
```

Then in `mapResoToProperty`'s returned object, add these two lines right after `listPrice: raw.ListPrice ?? 0,`:

```ts
    listPrice: raw.ListPrice ?? 0,
    closePrice: raw.ClosePrice ?? null,
    closeDate: raw.CloseDate ? new Date(raw.CloseDate) : null,
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/field-map.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/lib/idx/client.ts apps/web/src/lib/idx/field-map.ts apps/web/src/__tests__/lib/field-map.test.ts
git commit -m "feat: sync ClosePrice/CloseDate from CRMLS for sold comps"
```

**Note for later (not a task in this plan):** existing `Closed` rows already in the DB will have `closePrice: null` until the next full IDX resync. A resync (`POST /api/idx/sync?type=full`, per CLAUDE.md's documented procedure) must run before comps have real data — flag this to Ryan before considering the feature "live."

---

## Task 3: `computeEstimate()` — pure median-$/sqft calculation

**Files:**
- Create: `apps/web/src/lib/home-value-estimate.ts`
- Test: `apps/web/src/__tests__/lib/home-value-estimate.test.ts` (new)

**Interfaces:**
- Produces:
  - `export interface CompInput { closePrice: number; sqft: number; }`
  - `export interface EstimateResult { pointEstimate: number; rangeLow: number; rangeHigh: number; compCount: number; }`
  - `export function computeEstimate(comps: CompInput[], subjectSqft: number | null): EstimateResult | null`
  - `export function percentile(sorted: number[], p: number): number` (internal helper, exported for reuse in Task 6)
  - Consumed by: Task 7 (API route), Task 6 (`getMarketSnapshot` reuses `percentile`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/lib/home-value-estimate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeEstimate, percentile } from "@/lib/home-value-estimate";

describe("percentile", () => {
  it("returns the single value for a one-element array", () => {
    expect(percentile([500], 0.5)).toBe(500);
  });

  it("returns the median for an odd-length sorted array", () => {
    expect(percentile([100, 200, 300], 0.5)).toBe(200);
  });

  it("interpolates for an even-length sorted array", () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
  });
});

describe("computeEstimate", () => {
  it("returns null for an empty comps array", () => {
    expect(computeEstimate([], 2000)).toBeNull();
  });

  it("returns null when subjectSqft is null, zero, or negative", () => {
    const comps = [{ closePrice: 500000, sqft: 1000 }];
    expect(computeEstimate(comps, null)).toBeNull();
    expect(computeEstimate(comps, 0)).toBeNull();
    expect(computeEstimate(comps, -100)).toBeNull();
  });

  it("computes a point estimate from the median $/sqft of comps", () => {
    // $/sqft: 500, 600, 700 -> median 600
    const comps = [
      { closePrice: 500000, sqft: 1000 },
      { closePrice: 600000, sqft: 1000 },
      { closePrice: 700000, sqft: 1000 },
    ];
    const result = computeEstimate(comps, 1500);
    expect(result).not.toBeNull();
    expect(result!.pointEstimate).toBe(900000); // 600 * 1500
    expect(result!.compCount).toBe(3);
  });

  it("computes rangeLow/rangeHigh from the 25th/75th percentile $/sqft", () => {
    const comps = [
      { closePrice: 500000, sqft: 1000 }, // 500
      { closePrice: 600000, sqft: 1000 }, // 600
      { closePrice: 700000, sqft: 1000 }, // 700
      { closePrice: 800000, sqft: 1000 }, // 800
    ];
    const result = computeEstimate(comps, 1000);
    expect(result).not.toBeNull();
    // sorted $/sqft: [500,600,700,800] -> p25=575, p75=725
    expect(result!.rangeLow).toBe(575000);
    expect(result!.rangeHigh).toBe(725000);
  });

  it("filters out comps with zero or missing sqft/closePrice before computing", () => {
    const comps = [
      { closePrice: 500000, sqft: 1000 },
      { closePrice: 0, sqft: 1000 },
      { closePrice: 500000, sqft: 0 },
    ];
    const result = computeEstimate(comps, 1000);
    expect(result).not.toBeNull();
    expect(result!.compCount).toBe(1);
  });

  it("returns null when all comps are filtered out as invalid", () => {
    const comps = [{ closePrice: 0, sqft: 1000 }];
    expect(computeEstimate(comps, 1000)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: FAIL — module `@/lib/home-value-estimate` does not exist.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/home-value-estimate.ts`:

```ts
export interface CompInput {
  closePrice: number;
  sqft: number;
}

export interface EstimateResult {
  pointEstimate: number;
  rangeLow: number;
  rangeHigh: number;
  compCount: number;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeEstimate(
  comps: CompInput[],
  subjectSqft: number | null
): EstimateResult | null {
  if (!subjectSqft || subjectSqft <= 0) return null;

  const pricesPerSqft = comps
    .filter((c) => c.sqft > 0 && c.closePrice > 0)
    .map((c) => c.closePrice / c.sqft)
    .sort((a, b) => a - b);

  if (pricesPerSqft.length === 0) return null;

  const median = percentile(pricesPerSqft, 0.5);
  const p25 = percentile(pricesPerSqft, 0.25);
  const p75 = percentile(pricesPerSqft, 0.75);

  return {
    pointEstimate: Math.round(median * subjectSqft),
    rangeLow: Math.round(p25 * subjectSqft),
    rangeHigh: Math.round(p75 * subjectSqft),
    compCount: pricesPerSqft.length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: add computeEstimate — median \$/sqft comps calculation"
```

---

## Task 4: `findSubjectProperty()` — DB address match for auto-fill + price history

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts`
- Modify: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Consumes: none new.
- Produces:
  - `export interface SubjectRecord { mlsNumber: string; status: string; beds: number | null; baths: number | null; sqft: number | null; lotSize: number | null; listPrice: number; closePrice: number | null; closeDate: Date | null; listedAt: Date | null; }`
  - `export async function findSubjectProperty(prisma: PrismaClient, address: string, zip: string): Promise<SubjectRecord[]>` — empty array means no match. Records are ordered most-recent-first. Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/lib/home-value-estimate.test.ts`, above the existing content add the mock setup at the very top of the file (before the `describe` blocks), and add a new `describe` block at the end:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
  },
}));
```

Update the top `import` line to also pull in `vi`:

```ts
import { describe, it, expect, vi } from "vitest";
```

Add this new `describe` block at the end of the file:

```ts
describe("findSubjectProperty", () => {
  it("queries by zip-exact and address-contains, ordered by listedAt desc", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await findSubjectProperty(prisma as any, "123 Main St", "91101");

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.zip).toBe("91101");
    expect(call.where.address.contains).toBe("123 Main St");
    expect(call.where.address.mode).toBe("insensitive");
    expect(call.orderBy).toEqual({ listedAt: "desc" });
  });

  it("returns the matched records unchanged", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [
      {
        mlsNumber: "ML1",
        status: "Closed",
        beds: 4,
        baths: 2,
        sqft: 1800,
        lotSize: 0.15,
        listPrice: 950000,
        closePrice: 940000,
        closeDate: new Date("2025-01-10"),
        listedAt: new Date("2024-11-01"),
      },
    ];
    vi.mocked(prisma.property.findMany).mockResolvedValue(fixture as any);

    const result = await findSubjectProperty(prisma as any, "123 Main St", "91101");
    expect(result).toEqual(fixture);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: FAIL — `findSubjectProperty is not a function` / import error.

- [ ] **Step 3: Add the implementation**

Append to `apps/web/src/lib/home-value-estimate.ts`:

```ts
import type { PrismaClient } from "@prisma/client";

export interface SubjectRecord {
  mlsNumber: string;
  status: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  listPrice: number;
  closePrice: number | null;
  closeDate: Date | null;
  listedAt: Date | null;
}

export async function findSubjectProperty(
  prisma: PrismaClient,
  address: string,
  zip: string
): Promise<SubjectRecord[]> {
  return prisma.property.findMany({
    where: {
      zip,
      address: { contains: address, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: {
      mlsNumber: true,
      status: true,
      beds: true,
      baths: true,
      sqft: true,
      lotSize: true,
      listPrice: true,
      closePrice: true,
      closeDate: true,
      listedAt: true,
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: PASS (11 tests total).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: add findSubjectProperty for DB address auto-fill and price history"
```

---

## Task 5: `findComps()` — sold comps with progressive widening

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts`
- Modify: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface CompRecord { mlsNumber: string; address: string; city: string; state: string; zip: string; beds: number | null; baths: number | null; sqft: number | null; closePrice: number; closeDate: Date; photos: unknown; }`
  - `export interface FindCompsParams { zip: string; beds: number | null; excludeMlsNumber?: string; }`
  - `export async function findComps(prisma: PrismaClient, params: FindCompsParams): Promise<CompRecord[]>` — consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to the end of `apps/web/src/__tests__/lib/home-value-estimate.test.ts`:

```ts
describe("findComps", () => {
  it("queries Closed status, non-null closePrice, exact zip, and a 6-month window first", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([{}, {}, {}] as any);

    await findComps(prisma as any, { zip: "91101", beds: 3 });

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.status).toBe("Closed");
    expect(call.where.closePrice.not).toBeNull();
    expect(call.where.zip).toBe("91101");
    expect(call.where.beds).toEqual({ gte: 2, lte: 4 });
    expect(call.orderBy).toEqual({ closeDate: "desc" });
  });

  it("returns immediately once a window yields >= 3 comps", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValueOnce([{}, {}, {}] as any);

    const result = await findComps(prisma as any, { zip: "91101", beds: 3 });

    expect(result).toHaveLength(3);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(1);
  });

  it("widens the time window when fewer than 3 comps are found", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([{}] as any) // 6mo: 1 comp, not enough
      .mockResolvedValueOnce([{}, {}, {}, {}] as any); // 12mo: 4 comps, enough

    const result = await findComps(prisma as any, { zip: "91101", beds: 3 });

    expect(result).toHaveLength(4);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
  });

  it("drops the beds constraint as a final fallback after all time windows fail", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([] as any) // 6mo
      .mockResolvedValueOnce([{}] as any) // 12mo
      .mockResolvedValueOnce([{}] as any) // 24mo
      .mockResolvedValueOnce([{}, {}] as any); // final fallback, no beds filter

    const result = await findComps(prisma as any, { zip: "91101", beds: 3 });

    expect(result).toHaveLength(2);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(4);
    const finalCall = vi.mocked(prisma.property.findMany).mock.calls[3][0] as any;
    expect(finalCall.where.beds).toBeUndefined();
  });

  it("excludes the subject's own mlsNumber when provided", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([{}, {}, {}] as any);

    await findComps(prisma as any, { zip: "91101", beds: 3, excludeMlsNumber: "ML1" });

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.mlsNumber).toEqual({ not: "ML1" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: FAIL — `findComps is not a function`.

- [ ] **Step 3: Add the implementation**

Append to `apps/web/src/lib/home-value-estimate.ts`:

```ts
import { Prisma } from "@prisma/client";

export interface CompRecord {
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  closePrice: number;
  closeDate: Date;
  photos: unknown;
}

export interface FindCompsParams {
  zip: string;
  beds: number | null;
  excludeMlsNumber?: string;
}

const MIN_COMPS = 3;
const WINDOW_MONTHS = [6, 12, 24];
const COMPS_SELECT = {
  mlsNumber: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  beds: true,
  baths: true,
  sqft: true,
  closePrice: true,
  closeDate: true,
  photos: true,
} as const;

async function queryComps(
  prisma: PrismaClient,
  zip: string,
  months: number,
  beds: number | null,
  excludeMlsNumber?: string
): Promise<CompRecord[]> {
  const closeDateAfter = new Date();
  closeDateAfter.setMonth(closeDateAfter.getMonth() - months);

  const where: Prisma.PropertyWhereInput = {
    status: "Closed",
    closePrice: { not: null },
    zip,
    closeDate: { gte: closeDateAfter },
  };
  if (excludeMlsNumber) where.mlsNumber = { not: excludeMlsNumber };
  if (beds != null) where.beds = { gte: beds - 1, lte: beds + 1 };

  return prisma.property.findMany({
    where,
    orderBy: { closeDate: "desc" },
    take: 25,
    select: COMPS_SELECT,
  }) as unknown as Promise<CompRecord[]>;
}

export async function findComps(
  prisma: PrismaClient,
  params: FindCompsParams
): Promise<CompRecord[]> {
  for (const months of WINDOW_MONTHS) {
    const rows = await queryComps(prisma, params.zip, months, params.beds, params.excludeMlsNumber);
    if (rows.length >= MIN_COMPS) return rows;
  }
  // Final fallback: widest window, no beds constraint
  return queryComps(prisma, params.zip, WINDOW_MONTHS[WINDOW_MONTHS.length - 1], null, params.excludeMlsNumber);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: add findComps with progressive time/beds widening"
```

---

## Task 6: `getMarketSnapshot()` — quarterly sold stats for a ZIP

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts`
- Modify: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Consumes: `percentile()` from Task 3.
- Produces: `export interface QuarterStat { label: string; count: number; medianPrice: number | null; }`, `export async function getMarketSnapshot(prisma: PrismaClient, zip: string): Promise<QuarterStat[]>` — always returns exactly 4 entries (oldest to newest). Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Add to the top of `apps/web/src/__tests__/lib/home-value-estimate.test.ts`, right after the existing `vi.mock("@/lib/prisma", ...)` block, add fake-timer setup:

```ts
import { beforeEach, afterEach } from "vitest";
```

(add `beforeEach, afterEach` to the existing `import { describe, it, expect, vi } from "vitest";` line instead of a separate import)

Add this `describe` block at the end of the file:

```ts
describe("getMarketSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:00:00Z")); // mid Q3 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns exactly 4 quarters, oldest to newest, ending in the current quarter", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    const result = await getMarketSnapshot(prisma as any, "91101");

    expect(result).toHaveLength(4);
    expect(result[3].label).toBe("2026 Q3");
    expect(result[0].label).toBe("2025 Q4");
  });

  it("counts sales and computes median price per quarter", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { closePrice: 700000, closeDate: new Date("2026-04-10") }, // Q2
      { closePrice: 900000, closeDate: new Date("2026-04-20") }, // Q2
      { closePrice: 800000, closeDate: new Date("2026-05-01") }, // Q2
    ] as any);

    const result = await getMarketSnapshot(prisma as any, "91101");
    const q2 = result.find((q) => q.label === "2026 Q2")!;

    expect(q2.count).toBe(3);
    expect(q2.medianPrice).toBe(800000);
  });

  it("returns medianPrice null and count 0 for a quarter with no sales", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    const result = await getMarketSnapshot(prisma as any, "91101");

    expect(result.every((q) => q.count === 0 && q.medianPrice === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: FAIL — `getMarketSnapshot is not a function`.

- [ ] **Step 3: Add the implementation**

Append to `apps/web/src/lib/home-value-estimate.ts`:

```ts
export interface QuarterStat {
  label: string;
  count: number;
  medianPrice: number | null;
}

function lastFourQuarters(): { label: string; start: Date; end: Date }[] {
  const now = new Date();
  const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const result: { label: string; start: Date; end: Date }[] = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(now.getFullYear(), currentQuarterStartMonth - i * 3, 1);
    const end = new Date(now.getFullYear(), currentQuarterStartMonth - i * 3 + 3, 1);
    const q = Math.floor(start.getMonth() / 3) + 1;
    result.push({ label: `${start.getFullYear()} Q${q}`, start, end });
  }
  return result;
}

export async function getMarketSnapshot(
  prisma: PrismaClient,
  zip: string
): Promise<QuarterStat[]> {
  const quarters = lastFourQuarters();
  const since = quarters[0].start;

  const rows = await prisma.property.findMany({
    where: { status: "Closed", zip, closePrice: { not: null }, closeDate: { gte: since } },
    select: { closePrice: true, closeDate: true },
  });

  return quarters.map(({ label, start, end }) => {
    const inQuarter = rows.filter(
      (r) => r.closeDate && r.closeDate >= start && r.closeDate < end
    );
    const prices = inQuarter
      .map((r) => r.closePrice as number)
      .sort((a, b) => a - b);
    return {
      label,
      count: inQuarter.length,
      medianPrice: prices.length ? percentile(prices, 0.5) : null,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/lib/home-value-estimate.test.ts
```

Expected: PASS (19 tests total).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: add getMarketSnapshot — quarterly sold stats per ZIP"
```

---

## Task 7: API route — `GET /api/home-value/estimate`

**Files:**
- Create: `apps/web/src/app/api/home-value/estimate/route.ts`
- Test: `apps/web/src/__tests__/api/home-value-estimate.test.ts` (new)

**Interfaces:**
- Consumes: `findSubjectProperty`, `findComps`, `computeEstimate`, `getMarketSnapshot` from `@/lib/home-value-estimate` (Tasks 3–6).
- Produces: JSON response shape (never includes `pointEstimate`):
  ```ts
  {
    subject: { beds: number|null; baths: number|null; sqft: number|null; lotSize: number|null; matched: boolean } | null;
    needsManualEntry: boolean;
    priceHistory: Array<{ mlsNumber: string; status: string; listPrice: number; closePrice: number|null; closeDate: string|null; listedAt: string|null }>;
    comps: Array<{ mlsNumber: string; address: string; city: string; state: string; zip: string; beds: number|null; baths: number|null; sqft: number|null; closePrice: number; closeDate: string; photos: unknown }>;
    range: { low: number; high: number; compCount: number } | null;
    marketSnapshot: Array<{ label: string; count: number; medianPrice: number|null }>;
  }
  ```
  Consumed by Task 15 (`/home-value` page).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/home-value-estimate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/home-value/estimate/route";

function makeRequest(qs: string) {
  return new Request(`http://localhost/api/home-value/estimate?${qs}`);
}

describe("GET /api/home-value/estimate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns needsManualEntry: true and null range when no subject match and no manual beds/sqft given", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    const res = await GET(makeRequest("address=999 Nowhere Ln&zip=90000"));
    const body = await res.json();

    expect(body.needsManualEntry).toBe(true);
    expect(body.subject).toBeNull();
    expect(body.range).toBeNull();
    expect(body.comps).toEqual([]);
  });

  it("uses the subject match's beds/sqft when found in the DB", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        {
          mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15,
          listPrice: 950000, closePrice: 940000, closeDate: new Date("2025-01-10"), listedAt: new Date("2024-11-01"),
        },
      ] as any) // findSubjectProperty
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1750, closePrice: 900000, closeDate: new Date("2026-01-01"), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1600, closePrice: 800000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1900, closePrice: 950000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any) // findComps
      .mockResolvedValueOnce([]); // getMarketSnapshot

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body.needsManualEntry).toBe(false);
    expect(body.subject).toEqual(expect.objectContaining({ beds: 4, baths: 2, sqft: 1800, matched: true }));
    expect(body.range).not.toBeNull();
    expect(body.range.compCount).toBe(3);
    expect(body.comps).toHaveLength(3);
    expect(body.priceHistory).toHaveLength(1);
  });

  it("uses manual beds/sqft query params when no DB match exists", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // findSubjectProperty — no match
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date("2026-01-01"), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=999 New Home Rd&zip=91101&beds=3&baths=2&sqft=1500"));
    const body = await res.json();

    expect(body.needsManualEntry).toBe(false);
    expect(body.subject).toEqual(expect.objectContaining({ beds: 3, baths: 2, sqft: 1500, matched: false }));
    expect(body.range).not.toBeNull();
  });

  it("never includes a pointEstimate field in the response", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        { mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15, listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date() },
      ] as any)
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "a", city: "c", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1800, closePrice: 900000, closeDate: new Date(), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body).not.toHaveProperty("pointEstimate");
    expect(JSON.stringify(body)).not.toContain("pointEstimate");
  });

  it("returns 400 when address or zip is missing", async () => {
    const res = await GET(makeRequest("address=123 Main St"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/api/home-value-estimate.test.ts
```

Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/home-value/estimate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeEstimate,
  findComps,
  findSubjectProperty,
  getMarketSnapshot,
} from "@/lib/home-value-estimate";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const zip = searchParams.get("zip");

  if (!address || !zip) {
    return NextResponse.json({ error: "address and zip are required" }, { status: 400 });
  }

  const manualBeds = searchParams.get("beds") ? Number(searchParams.get("beds")) : null;
  const manualBaths = searchParams.get("baths") ? Number(searchParams.get("baths")) : null;
  const manualSqft = searchParams.get("sqft") ? Number(searchParams.get("sqft")) : null;
  const manualLotSize = searchParams.get("lotSize") ? Number(searchParams.get("lotSize")) : null;

  try {
    const matches = await findSubjectProperty(prisma, address, zip);
    const latest = matches[0] ?? null;

    const beds = latest?.beds ?? manualBeds;
    const baths = latest?.baths ?? manualBaths;
    const sqft = latest?.sqft ?? manualSqft;
    const lotSize = latest?.lotSize ?? manualLotSize;

    if (sqft == null) {
      return NextResponse.json({
        subject: null,
        needsManualEntry: true,
        priceHistory: [],
        comps: [],
        range: null,
        marketSnapshot: [],
      });
    }

    const [comps, marketSnapshot] = await Promise.all([
      findComps(prisma, { zip, beds, excludeMlsNumber: latest?.mlsNumber }),
      getMarketSnapshot(prisma, zip),
    ]);

    const estimate = computeEstimate(
      comps.map((c) => ({ closePrice: c.closePrice, sqft: c.sqft ?? 0 })),
      sqft
    );

    return NextResponse.json({
      subject: { beds, baths, sqft, lotSize, matched: matches.length > 0 },
      needsManualEntry: false,
      priceHistory: matches.map((m) => ({
        mlsNumber: m.mlsNumber,
        status: m.status,
        listPrice: m.listPrice,
        closePrice: m.closePrice,
        closeDate: m.closeDate ? m.closeDate.toISOString() : null,
        listedAt: m.listedAt ? m.listedAt.toISOString() : null,
      })),
      comps: comps.map((c) => ({ ...c, closeDate: c.closeDate.toISOString() })),
      range: estimate ? { low: estimate.rangeLow, high: estimate.rangeHigh, compCount: estimate.compCount } : null,
      marketSnapshot,
    });
  } catch (err) {
    console.error("[home-value/estimate] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/api/home-value-estimate.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/app/api/home-value/estimate/route.ts apps/web/src/__tests__/api/home-value-estimate.test.ts
git commit -m "feat: add GET /api/home-value/estimate (range/comps, no point estimate)"
```

---

## Task 8: API route — `POST /api/home-value/reveal`

**Files:**
- Create: `apps/web/src/app/api/home-value/reveal/route.ts`
- Test: `apps/web/src/__tests__/api/home-value-reveal.test.ts` (new)

**Interfaces:**
- Consumes: `findComps`, `computeEstimate` from `@/lib/home-value-estimate`; `publicFormRateLimit` from `@/lib/rate-limit`; `sendLeadNotification` from `@/lib/email`.
- Produces: `{ pointEstimate: number }` on success (201). Creates a `Lead` with `source: "HOME_VALUATION"`. Consumed by Task 14 (`RevealEstimateForm`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/home-value-reveal.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { findMany: vi.fn() }, lead: { create: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));
vi.mock("@/lib/email", () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/home-value/reveal/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/home-value/reveal", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "555-123-4567",
  address: "123 Main St",
  zip: "91101",
  beds: 3,
  sqft: 1500,
};

describe("POST /api/home-value/reveal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ firstName: "Jane" }));
    expect(res.status).toBe(400);
  });

  it("creates a Lead with source HOME_VALUATION and the address in notes", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date(), photos: [] },
    ] as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "HOME_VALUATION",
          email: "jane@example.com",
          notes: expect.stringContaining("123 Main St"),
        }),
      })
    );
  });

  it("returns a pointEstimate on success", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date(), photos: [] },
    ] as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(typeof body.pointEstimate).toBe("number");
    expect(body.pointEstimate).toBeGreaterThan(0);
  });

  it("returns 429 when rate limited", async () => {
    const { publicFormRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 60000 } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/api/home-value-reveal.test.ts
```

Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/home-value/reveal/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeEstimate, findComps } from "@/lib/home-value-estimate";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { sendLeadNotification } from "@/lib/email";

const revealSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone required"),
  address: z.string().min(1),
  zip: z.string().min(1),
  beds: z.number().nullable(),
  sqft: z.number(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  try {
    const { success, reset } = await publicFormRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (err) {
    console.error("[home-value/reveal] rate limiter unavailable, proceeding:", err);
  }

  try {
    const body = await req.json();
    const data = revealSchema.parse(body);

    const comps = await findComps(prisma, { zip: data.zip, beds: data.beds });
    const estimate = computeEstimate(
      comps.map((c) => ({ closePrice: c.closePrice, sqft: c.sqft ?? 0 })),
      data.sqft
    );

    if (!estimate) {
      return NextResponse.json({ error: "Not enough local data to compute an estimate" }, { status: 422 });
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        source: "HOME_VALUATION",
        notes: `Home value request for ${data.address}, ${data.zip}. Estimated at $${estimate.pointEstimate.toLocaleString()}.`,
      },
    });
    sendLeadNotification(lead).catch(console.error);

    return NextResponse.json({ pointEstimate: estimate.pointEstimate }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("[home-value/reveal] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/api/home-value-reveal.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/app/api/home-value/reveal/route.ts apps/web/src/__tests__/api/home-value-reveal.test.ts
git commit -m "feat: add POST /api/home-value/reveal — creates Lead, returns point estimate"
```

---

## Task 9: `AddressAutocomplete.tsx` — Mapbox-backed debounced address input

**Files:**
- Create: `apps/web/src/components/home-value/AddressAutocomplete.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_MAPBOX_TOKEN` env var (already present).
- Produces: `export interface AddressSuggestion { fullAddress: string; street: string; zip: string; lat: number; lng: number; }`, `export function AddressAutocomplete(props: { onSelect: (s: AddressSuggestion) => void; placeholder?: string }): JSX.Element`. Consumed by Task 10.

No dedicated unit test for this task — it's a thin fetch/debounce/dropdown wrapper with no non-trivial pure logic to extract (matches this codebase's existing convention of not unit-testing components unless they contain extractable pure logic, e.g. `RentCitiesSlider.tsx`'s `getSlideState`).

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/home-value/AddressAutocomplete.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export interface AddressSuggestion {
  fullAddress: string;
  street: string;
  zip: string;
  lat: number;
  lng: number;
}

interface Props {
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
}

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: { id: string; text: string }[];
  text: string;
  address?: string;
}

export function AddressAutocomplete({ onSelect, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 5) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        value
      )}.json?access_token=${token}&country=us&types=address&limit=5`;
      try {
        const res = await fetch(url);
        const json = await res.json();
        const features: MapboxFeature[] = json.features ?? [];
        const parsed = features.map((f) => {
          const zipContext = f.context?.find((c) => c.id.startsWith("postcode"));
          const streetPart = f.address ? `${f.address} ${f.text}` : f.text;
          return {
            fullAddress: f.place_name,
            street: streetPart,
            zip: zipContext?.text ?? "",
            lat: f.center[1],
            lng: f.center[0],
          };
        });
        setSuggestions(parsed);
        setOpen(parsed.length > 0);
      } catch (err) {
        console.error("[AddressAutocomplete] geocoding failed:", err);
      }
    }, 400);
  }

  function handleSelect(s: AddressSuggestion) {
    setQuery(s.fullAddress);
    setOpen(false);
    onSelect(s);
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? "Enter Your Address"}
        className="w-full rounded-lg border border-[#1B1B1B]/15 bg-white px-5 py-4 text-[#1B1B1B] placeholder:text-[#1B1B1B]/40 focus:outline-none focus:ring-1 focus:ring-cnc-gold"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.fullAddress}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="block w-full px-5 py-3 text-left text-sm text-[#1B1B1B] hover:bg-cnc-bg"
              >
                {s.fullAddress}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm exec tsc --noEmit
```

Expected: no new type errors introduced by this file (pre-existing unrelated errors, if any, are not this task's concern — see the 2026-06-02 session note in CLAUDE.md about pre-existing TS errors in `Testimonials.tsx`/`Navbar.tsx`/test files).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/components/home-value/AddressAutocomplete.tsx
git commit -m "feat: add AddressAutocomplete — debounced Mapbox geocoding input"
```

---

## Task 10: `HomeValueTeaser.tsx` — `/sell` page entry section

**Files:**
- Create: `apps/web/src/components/sell/HomeValueTeaser.tsx`
- Modify: `apps/web/src/app/(marketing)/sell/page.tsx`

**Interfaces:**
- Consumes: `AddressAutocomplete` from Task 9.
- Produces: nothing consumed by later tasks (leaf UI).

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/sell/HomeValueTeaser.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Calculator, Tag, TrendingUp, BarChart3 } from "lucide-react";
import { AddressAutocomplete, AddressSuggestion } from "@/components/home-value/AddressAutocomplete";

const FEATURES = [
  { icon: Calculator, label: "Our Estimate", body: "Get a data-driven estimate based on real, local sales." },
  { icon: Tag, label: "Comparable Sales", body: "See what similar homes nearby have actually sold for." },
  { icon: TrendingUp, label: "Price History", body: "See past sale dates and prices for your home." },
  { icon: BarChart3, label: "Local Market Snapshot", body: "See recent sale activity in your ZIP code." },
];

export function HomeValueTeaser() {
  const router = useRouter();

  function handleSelect(s: AddressSuggestion) {
    const params = new URLSearchParams({
      address: s.street,
      zip: s.zip,
      lat: String(s.lat),
      lng: String(s.lng),
    });
    router.push(`/home-value?${params.toString()}`);
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h2 className="font-sans text-[1.9rem] font-light text-[#1B1B1B] xl:text-[2.2rem]">
        Sell <span className="text-cnc-gold font-medium">Smarter</span>
      </h2>
      <p className="mt-4 text-[#1B1B1B]/60">
        Sell your home smarter with more data and insight with our free home value report.
      </p>

      <div className="mx-auto mt-10 max-w-xl">
        <AddressAutocomplete onSelect={handleSelect} />
      </div>

      <div className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-x-10 gap-y-8 text-left sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, label, body }) => (
          <div key={label} className="flex gap-4">
            <Icon className="mt-1 h-5 w-5 shrink-0 text-[#1B1B1B]/70" strokeWidth={1.5} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#1B1B1B]">{label}</p>
              <p className="mt-1 text-sm text-[#1B1B1B]/60">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into `/sell`**

In `apps/web/src/app/(marketing)/sell/page.tsx`, add the import:

```tsx
import { HomeValueTeaser } from "@/components/sell/HomeValueTeaser";
```

Then insert `<HomeValueTeaser />` between `<SellValues />` and the `GradientBridge` before FAQ:

```tsx
        <SellProcess />
        <SellValues />
        <HomeValueTeaser />
        <GradientBridge from="#F2F0EF" to="#DAD4D2" />
        <FAQ className="bg-[#DAD4D2]" faqs={SELL_FAQS} />
```

- [ ] **Step 3: Verify it compiles**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm exec tsc --noEmit
```

Expected: no new type errors from these two files.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/components/sell/HomeValueTeaser.tsx "apps/web/src/app/(marketing)/sell/page.tsx"
git commit -m "feat: add HomeValueTeaser section to /sell page, above FAQ"
```

---

## Task 11: `ComparableSales.tsx` — sold comps list

**Files:**
- Create: `apps/web/src/components/home-value/ComparableSales.tsx`

**Interfaces:**
- Consumes: the `comps` array shape produced by `GET /api/home-value/estimate` (Task 7).
- Produces: `export function ComparableSales(props: { comps: CompDisplay[] }): JSX.Element`, `export interface CompDisplay { mlsNumber: string; address: string; city: string; state: string; zip: string; beds: number | null; baths: number | null; sqft: number | null; closePrice: number; closeDate: string; photos: unknown }`. Consumed by Task 15.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/home-value/ComparableSales.tsx`:

```tsx
export interface CompDisplay {
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  closePrice: number;
  closeDate: string;
  photos: unknown;
}

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === "string") return photos[0];
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function ComparableSales({ comps }: { comps: CompDisplay[] }) {
  if (comps.length === 0) {
    return (
      <section className="py-10">
        <h3 className="text-xl font-medium text-[#1B1B1B]">Comparable Sales</h3>
        <p className="mt-3 text-sm text-[#1B1B1B]/50">
          Not enough recent sales nearby to show comparables yet.
        </p>
      </section>
    );
  }

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Comparable Sales</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes similar to yours that have recently sold nearby.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comps.map((c) => {
          const thumb = firstPhoto(c.photos);
          return (
            <div key={c.mlsNumber} className="overflow-hidden rounded-xl border border-[#1B1B1B]/10 bg-white">
              <div className="relative aspect-[4/3] w-full bg-[#eae7e3]">
                {thumb ? (
                  <img src={thumb} alt={c.address} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[#1B1B1B]/30">
                    No photo
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-base font-bold text-[#1B1B1B]">
                  Sold for ${c.closePrice.toLocaleString()}
                </p>
                <p className="text-xs text-[#1B1B1B]/50">on {formatDate(c.closeDate)}</p>
                <p className="mt-1 text-xs text-[#1B1B1B]/60">
                  {c.beds ?? "—"} bd | {c.baths ?? "—"} ba | {c.sqft?.toLocaleString() ?? "—"} sqft
                </p>
                <p className="mt-1 truncate text-xs text-[#1B1B1B]/50">
                  {c.address}, {c.city}, {c.state}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/components/home-value/ComparableSales.tsx
git commit -m "feat: add ComparableSales component for /home-value report"
```

---

## Task 12: `PriceHistory.tsx` — subject property's own past listings/sales

**Files:**
- Create: `apps/web/src/components/home-value/PriceHistory.tsx`

**Interfaces:**
- Consumes: the `priceHistory` array shape produced by `GET /api/home-value/estimate` (Task 7).
- Produces: `export function PriceHistory(props: { history: PriceHistoryEntry[] }): JSX.Element`, `export interface PriceHistoryEntry { mlsNumber: string; status: string; listPrice: number; closePrice: number | null; closeDate: string | null; listedAt: string | null }`. Consumed by Task 15. Renders nothing (`null`) when `history` is empty — matches the spec's "if the subject has MLS history" conditional.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/home-value/PriceHistory.tsx`:

```tsx
export interface PriceHistoryEntry {
  mlsNumber: string;
  status: string;
  listPrice: number;
  closePrice: number | null;
  closeDate: string | null;
  listedAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function PriceHistory({ history }: { history: PriceHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Price History</h3>
      <div className="mt-6 divide-y divide-[#1B1B1B]/10 rounded-xl border border-[#1B1B1B]/10 bg-white">
        {history.map((h) => (
          <div key={h.mlsNumber} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#1B1B1B]">{h.status}</p>
              <p className="text-xs text-[#1B1B1B]/50">
                {h.closeDate ? `Sold ${formatDate(h.closeDate)}` : `Listed ${formatDate(h.listedAt)}`}
              </p>
            </div>
            <p className="text-base font-bold text-[#1B1B1B]">
              ${(h.closePrice ?? h.listPrice).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/components/home-value/PriceHistory.tsx
git commit -m "feat: add PriceHistory component for /home-value report"
```

---

## Task 13: `LocalMarketSnapshot.tsx` — quarterly sold-homes bar chart

**Files:**
- Create: `apps/web/src/components/home-value/LocalMarketSnapshot.tsx`
- Test: `apps/web/src/__tests__/components/LocalMarketSnapshot.test.ts` (new)

**Interfaces:**
- Consumes: the `marketSnapshot` array shape (`QuarterStat[]`) produced by `GET /api/home-value/estimate` (Task 7).
- Produces: `export function computeBarHeights(quarters: { count: number }[]): number[]` (pure, tested), `export function LocalMarketSnapshot(props: { quarters: QuarterStat[] }): JSX.Element`. Consumed by Task 15.

No charting library dependency is added — matches this codebase's existing pattern of hand-rolled `div`-based visualizations (e.g. `StatsBar.tsx`, progress bars) rather than pulling in Recharts/Victory/etc. for 4 bars.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/components/LocalMarketSnapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBarHeights } from "@/components/home-value/LocalMarketSnapshot";

describe("computeBarHeights", () => {
  it("scales the tallest bar to 100", () => {
    const heights = computeBarHeights([{ count: 4 }, { count: 8 }, { count: 2 }]);
    expect(heights[1]).toBe(100);
  });

  it("scales other bars proportionally to the max", () => {
    const heights = computeBarHeights([{ count: 4 }, { count: 8 }]);
    expect(heights[0]).toBe(50);
  });

  it("returns all zeros when every quarter has zero sales, without dividing by zero", () => {
    const heights = computeBarHeights([{ count: 0 }, { count: 0 }]);
    expect(heights).toEqual([0, 0]);
  });

  it("handles a single quarter", () => {
    expect(computeBarHeights([{ count: 5 }])).toEqual([100]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/components/LocalMarketSnapshot.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/home-value/LocalMarketSnapshot.tsx`:

```tsx
export interface QuarterStat {
  label: string;
  count: number;
  medianPrice: number | null;
}

export function computeBarHeights(quarters: { count: number }[]): number[] {
  const max = Math.max(0, ...quarters.map((q) => q.count));
  if (max === 0) return quarters.map(() => 0);
  return quarters.map((q) => Math.round((q.count / max) * 100));
}

export function LocalMarketSnapshot({ quarters }: { quarters: QuarterStat[] }) {
  const heights = computeBarHeights(quarters);
  const latestWithSales = [...quarters].reverse().find((q) => q.medianPrice != null);

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Local Market Snapshot</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes sold per quarter in your ZIP code.
      </p>

      <div className="mt-8 flex h-40 items-end gap-6">
        {quarters.map((q, i) => (
          <div key={q.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end">
              <div
                className="w-full rounded-t bg-cnc-gold/70"
                style={{ height: `${heights[i]}%` }}
              />
            </div>
            <p className="text-xs text-[#1B1B1B]/60">{q.label}</p>
            <p className="text-xs font-medium text-[#1B1B1B]">{q.count}</p>
          </div>
        ))}
      </div>

      {latestWithSales && (
        <p className="mt-6 text-sm text-[#1B1B1B]/60">
          <span className="font-bold text-[#1B1B1B]">
            ${latestWithSales.medianPrice!.toLocaleString()}
          </span>{" "}
          median sold price in {latestWithSales.label}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test -- src/__tests__/components/LocalMarketSnapshot.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/components/home-value/LocalMarketSnapshot.tsx apps/web/src/__tests__/components/LocalMarketSnapshot.test.ts
git commit -m "feat: add LocalMarketSnapshot bar chart for /home-value report"
```

---

## Task 14: `RevealEstimateForm.tsx` — gated point-estimate form

**Files:**
- Create: `apps/web/src/components/home-value/RevealEstimateForm.tsx`

**Interfaces:**
- Consumes: `POST /api/home-value/reveal` (Task 8).
- Produces: `export function RevealEstimateForm(props: { address: string; zip: string; beds: number | null; sqft: number }): JSX.Element`. Consumed by Task 15.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/home-value/RevealEstimateForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

interface Props {
  address: string;
  zip: string;
  beds: number | null;
  sqft: number;
}

export function RevealEstimateForm({ address, zip, beds, sqft }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointEstimate, setPointEstimate] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/home-value/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone, address, zip, beds, sqft }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setPointEstimate(body.pointEstimate);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pointEstimate != null) {
    return (
      <section className="rounded-xl border border-cnc-gold/30 bg-white py-10 text-center">
        <p className="text-sm text-[#1B1B1B]/50">Your Estimated Home Value</p>
        <p className="mt-2 text-4xl font-bold text-[#1B1B1B]">
          ${pointEstimate.toLocaleString()}
        </p>
        <p className="mt-4 text-sm text-[#1B1B1B]/60">
          A CnC agent will follow up shortly with a full comparative market analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#1B1B1B]/10 bg-white p-8">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Get Your Exact Estimate</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Enter your info to reveal your home's precise estimated value.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B]"
          aria-label="First Name"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B]"
          aria-label="Last Name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B] sm:col-span-2"
          aria-label="Email"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B] sm:col-span-2"
          aria-label="Phone"
        />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <motion.button
          type="submit"
          disabled={loading}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="rounded-full bg-[#1B1B1B] py-3 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
        >
          {loading ? "Getting your estimate…" : "Get My Exact Estimate"}
        </motion.button>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add apps/web/src/components/home-value/RevealEstimateForm.tsx
git commit -m "feat: add RevealEstimateForm — gated point-estimate lead capture"
```

---

## Task 15: `/home-value` page — full assembly

**Files:**
- Create: `apps/web/src/app/(marketing)/home-value/page.tsx`

**Interfaces:**
- Consumes: `GET /api/home-value/estimate` (Task 7); `ComparableSales` (Task 11); `PriceHistory` (Task 12); `LocalMarketSnapshot` (Task 13); `RevealEstimateForm` (Task 14).
- Produces: nothing consumed by later tasks — this is the final page.

- [ ] **Step 1: Write the page**

Create `apps/web/src/app/(marketing)/home-value/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComparableSales, CompDisplay } from "@/components/home-value/ComparableSales";
import { PriceHistory, PriceHistoryEntry } from "@/components/home-value/PriceHistory";
import { LocalMarketSnapshot, QuarterStat } from "@/components/home-value/LocalMarketSnapshot";
import { RevealEstimateForm } from "@/components/home-value/RevealEstimateForm";

interface EstimateResponse {
  subject: { beds: number | null; baths: number | null; sqft: number | null; lotSize: number | null; matched: boolean } | null;
  needsManualEntry: boolean;
  priceHistory: PriceHistoryEntry[];
  comps: CompDisplay[];
  range: { low: number; high: number; compCount: number } | null;
  marketSnapshot: QuarterStat[];
}

function ManualEntryForm({ onSubmit }: { onSubmit: (beds: number, baths: number, sqft: number) => void }) {
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");

  return (
    <div className="mx-auto max-w-md rounded-xl border border-[#1B1B1B]/10 bg-white p-8 text-center">
      <p className="text-sm text-[#1B1B1B]/60">
        We don't have this address on file yet — tell us a bit about the home to get an estimate.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Number(beds), Number(baths), Number(sqft));
        }}
        className="mt-6 grid grid-cols-3 gap-3"
      >
        <input value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="Beds" type="number" required className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-3 py-3 text-center text-[#1B1B1B]" />
        <input value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="Baths" type="number" step="0.5" required className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-3 py-3 text-center text-[#1B1B1B]" />
        <input value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="Sqft" type="number" required className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-3 py-3 text-center text-[#1B1B1B]" />
        <button type="submit" className="col-span-3 mt-2 rounded-full bg-[#1B1B1B] py-3 text-sm font-medium text-white">
          Get My Estimate
        </button>
      </form>
    </div>
  );
}

export default function HomeValuePage() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";
  const zip = searchParams.get("zip") ?? "";

  const [data, setData] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualOverride, setManualOverride] = useState<{ beds: number; baths: number; sqft: number } | null>(null);

  useEffect(() => {
    if (!address || !zip) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ address, zip });
    if (manualOverride) {
      params.set("beds", String(manualOverride.beds));
      params.set("baths", String(manualOverride.baths));
      params.set("sqft", String(manualOverride.sqft));
    }
    fetch(`/api/home-value/estimate?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: EstimateResponse) => setData(json))
      .catch((err) => {
        if (!controller.signal.aborted) console.error("[home-value] fetch failed:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [address, zip, manualOverride]);

  if (!address || !zip) {
    return (
      <main className="bg-cnc-bg px-6 py-32 text-center">
        <p className="text-[#1B1B1B]/60">No address provided. Go back to /sell and enter your address.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="bg-cnc-bg px-6 py-32 text-center">
        <p className="text-[#1B1B1B]/60">Looking up your home…</p>
      </main>
    );
  }

  if (data?.needsManualEntry) {
    return (
      <main className="bg-cnc-bg px-6 py-32">
        <ManualEntryForm onSubmit={(beds, baths, sqft) => setManualOverride({ beds, baths, sqft })} />
      </main>
    );
  }

  return (
    <main className="bg-cnc-bg px-6 pb-24 pt-32">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-[#1B1B1B]/50">Estimated Home Value for</p>
        <h1 className="mt-1 text-2xl font-medium text-[#1B1B1B]">{address}</h1>

        {data?.range && (
          <section className="mt-8 rounded-xl border border-[#1B1B1B]/10 bg-white p-8 text-center">
            <p className="text-sm text-[#1B1B1B]/50">Estimated Value Range</p>
            <p className="mt-2 text-3xl font-bold text-[#1B1B1B]">
              ${data.range.low.toLocaleString()} – ${data.range.high.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[#1B1B1B]/40">
              Based on {data.range.compCount} comparable recent sales nearby.
            </p>
          </section>
        )}

        {data && <RevealEstimateForm address={address} zip={zip} beds={data.subject?.beds ?? null} sqft={data.subject?.sqft ?? 0} />}

        {data && <ComparableSales comps={data.comps} />}
        {data && <PriceHistory history={data.priceHistory} />}
        {data && <LocalMarketSnapshot quarters={data.marketSnapshot} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Run the full test suite**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty\apps\web" && pnpm test
```

Expected: all tests pass, including the new ones added across this plan.

- [ ] **Step 4: Manual smoke test**

With the dev server running (`pnpm --filter web dev`):
1. Open `/sell`, scroll to the new "Sell Smarter" section above the FAQ.
2. Type a real address that exists in the CRMLS DB (e.g. an address from `/properties`), select it from the autocomplete dropdown.
3. Confirm it navigates to `/home-value?address=...&zip=...` and shows a value range, comps, and market snapshot without requiring a form.
4. Submit the "Get My Exact Estimate" form and confirm a precise dollar figure appears, and that a new `Lead` with `source: HOME_VALUATION` shows up in `/admin/leads`.
5. Try an address NOT in the DB (e.g. a random real address) and confirm the manual beds/baths/sqft form appears and the flow still completes.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\hey_r\Desktop\CnC-Realty"
git add "apps/web/src/app/(marketing)/home-value/page.tsx"
git commit -m "feat: add /home-value report page — completes home value estimator"
```

---

## Self-Review Notes

- **Spec coverage:** §1 schema → Task 1; §1 IDX → Task 2; §2 `/sell` teaser → Tasks 9–10; §3 report flow (geocode/subject/comps/estimate/render) → Tasks 4, 5, 15; §4 estimate methodology → Task 3; §5 API routes → Tasks 7–8; §6 files list → matches all tasks' file paths. All spec sections have a corresponding task.
- **Type consistency checked:** `SubjectRecord`/`CompRecord`/`QuarterStat`/`EstimateResult` field names verified consistent between their defining task (3/4/5/6) and every consuming task (7, 11, 12, 13, 15).
- **Deviation from spec flagged explicitly:** comps matching uses zip-exact rather than a lat/long bounding box (Global Constraints + Task 5) — within the spec's stated "same ZIP (or small lat/long bounding box)" allowance, not a silent scope change.
- **Known follow-up outside this plan's scope:** a full IDX resync is required after Task 2 ships before existing `Closed` rows have real `closePrice` data — called out as a note under Task 2, not a task itself, since it's an operational step (documented elsewhere in CLAUDE.md), not new code.
