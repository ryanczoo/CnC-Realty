# Local Market Snapshot — Price Histogram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/home-value` page's "sales by quarter over the last year" chart with a "sales by price over the last 90 days" chart, matching what CRMLS's feed can actually support.

**Architecture:** `getMarketSnapshot` in `apps/web/src/lib/home-value-estimate.ts` changes its query window from ~1 year (4 calendar quarters) to a flat trailing 90 days, and changes its output from quarter buckets to price buckets. Below 5 sales it emits one bar per sale (bar height = that sale's price); at 5+ sales it emits a histogram (bar height = count per price band, band width picked from a "nice number" table). `LocalMarketSnapshot.tsx` renders whichever shape it's given — the bar-scaling logic (`computeBarHeights`) is already generic and needs no behavior change, only a field rename. `page.tsx` and `route.ts` are updated to match the renamed/reshaped type.

**Tech Stack:** Next.js 14 App Router, Prisma, Vitest.

## Global Constraints

- Zero-sales copy is exact: `No sales within 90 days in {zip}` (Ryan specified this verbatim).
- Sparse threshold: fewer than 5 sales in the 90-day window → one bar per sale, not a histogram.
- Histogram target: ~5-6 bins, bin width chosen from `[10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000]` — smallest step where `ceil(range / step) <= 6`.
- Query scope stays broad (ZIP-only, no beds/propertyType filter) — this section is "what's happening in your ZIP," distinct from the narrower `comps` list used for the estimate math elsewhere on the page.
- Median-price line only renders when there's at least 1 sale; copy is `$X median sold price in the last 90 days`.
- `QuarterStat` is renamed to `PriceBar` and consolidated to a single definition in `apps/web/src/lib/home-value-estimate.ts` (today it's independently duplicated in both that file and `LocalMarketSnapshot.tsx` — fold into one source of truth as part of this change).
- No new queries, no new round trips — this must not regress the "will this be slower" answer already given to Ryan (single query, parallelized with `findComps` via the existing `Promise.all` in the route, unchanged).

---

### Task 1: Price-bucketing pure functions + `getMarketSnapshot` rewrite

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts`
- Test: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Produces: `export interface PriceBar { label: string; value: number; count?: number }`, `export function formatPriceShort(n: number): string`, `export function pickBinWidth(min: number, max: number): number`, `export function buildPriceBars(sales: { closePrice: number }[]): PriceBar[]`, `export async function getMarketSnapshot(prisma: PrismaClient, zip: string): Promise<{ bars: PriceBar[]; medianPrice: number | null }>` (signature unchanged, return type changed).
- Consumes: existing `percentile()` in the same file (unchanged).

- [ ] **Step 1: Write the failing tests**

Replace the entire `describe("getMarketSnapshot", ...)` block (currently lines 388-446) with:

```typescript
describe("formatPriceShort", () => {
  it("formats sub-million prices as rounded thousands", () => {
    expect(formatPriceShort(725000)).toBe("$725K");
  });

  it("formats million-plus prices with two decimal places", () => {
    expect(formatPriceShort(1250000)).toBe("$1.25M");
  });

  it("formats an exact million without trailing decimals", () => {
    expect(formatPriceShort(2000000)).toBe("$2M");
  });
});

describe("pickBinWidth", () => {
  it("picks the smallest nice step that keeps bins at or under the target of 6", () => {
    // range 500000, step 100000 -> 5 bins, fits
    expect(pickBinWidth(400000, 900000)).toBe(100000);
  });

  it("falls back to the largest step for a very wide range", () => {
    expect(pickBinWidth(100000, 50000000)).toBe(5000000);
  });

  it("handles min === max without dividing by zero", () => {
    expect(pickBinWidth(500000, 500000)).toBe(10000);
  });
});

describe("buildPriceBars", () => {
  it("returns an empty array for zero sales", () => {
    expect(buildPriceBars([])).toEqual([]);
  });

  it("returns one bar per sale, sorted by price ascending, when below the sparse threshold", () => {
    const bars = buildPriceBars([
      { closePrice: 900000 },
      { closePrice: 500000 },
      { closePrice: 700000 },
    ]);
    expect(bars).toEqual([
      { label: "$500K", value: 500000 },
      { label: "$700K", value: 700000 },
      { label: "$900K", value: 900000 },
    ]);
  });

  it("bins into a price histogram at 5 or more sales, with count on each bar", () => {
    const sales = [
      { closePrice: 410000 },
      { closePrice: 420000 },
      { closePrice: 830000 },
      { closePrice: 840000 },
      { closePrice: 850000 },
    ];
    const bars = buildPriceBars(sales);
    const total = bars.reduce((sum, b) => sum + (b.count ?? 0), 0);
    expect(total).toBe(5);
    expect(bars.every((b) => b.count != null)).toBe(true);
    expect(bars.every((b) => b.label.includes("–"))).toBe(true);
  });
});

describe("getMarketSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries a flat trailing-90-day window", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await getMarketSnapshot(prisma as any, "91101");

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    const expectedSince = new Date("2026-07-12T12:00:00Z");
    expectedSince.setDate(expectedSince.getDate() - 90);
    expect(call.where.closeDate.gte.toISOString().slice(0, 10)).toBe(
      expectedSince.toISOString().slice(0, 10)
    );
  });

  it("only counts FOR_SALE listings, excluding closed rentals", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await getMarketSnapshot(prisma as any, "91101");

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.listingType).toBe("FOR_SALE");
  });

  it("returns an empty bars array and null median when there are no sales", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    const result = await getMarketSnapshot(prisma as any, "91101");

    expect(result.bars).toEqual([]);
    expect(result.medianPrice).toBeNull();
  });

  it("computes the median price across all sales in the window", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { closePrice: 700000 },
      { closePrice: 900000 },
      { closePrice: 800000 },
    ] as any);

    const result = await getMarketSnapshot(prisma as any, "91101");

    expect(result.medianPrice).toBe(800000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web vitest run src/__tests__/lib/home-value-estimate.test.ts`
Expected: FAIL — `formatPriceShort`, `pickBinWidth`, `buildPriceBars` are not exported yet, and the old `getMarketSnapshot` tests (quarter-shaped assertions) no longer match the new test bodies replacing them, so these specific new tests fail with "is not a function" / assertion mismatches, not a syntax error.

- [ ] **Step 3: Replace the quarter-grouping implementation**

In `apps/web/src/lib/home-value-estimate.ts`, delete the existing `QuarterStat` interface, `lastFourQuarters()` function, and `getMarketSnapshot()` function (current lines 246-290), and replace with:

```typescript
export interface PriceBar {
  label: string;
  value: number;
  count?: number;
}

const NICE_STEPS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];
const TARGET_BINS = 6;
const SPARSE_THRESHOLD = 5;

export function formatPriceShort(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `$${Math.round(n / 1000)}K`;
}

export function pickBinWidth(min: number, max: number): number {
  const range = Math.max(max - min, 1);
  for (const step of NICE_STEPS) {
    if (Math.ceil(range / step) <= TARGET_BINS) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

export function buildPriceBars(sales: { closePrice: number }[]): PriceBar[] {
  if (sales.length === 0) return [];

  if (sales.length < SPARSE_THRESHOLD) {
    return [...sales]
      .sort((a, b) => a.closePrice - b.closePrice)
      .map((s) => ({ label: formatPriceShort(s.closePrice), value: s.closePrice }));
  }

  const prices = sales.map((s) => s.closePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const width = pickBinWidth(min, max);
  const startBin = Math.floor(min / width) * width;

  const bins = new Map<number, number>();
  for (const price of prices) {
    const binStart = startBin + Math.floor((price - startBin) / width) * width;
    bins.set(binStart, (bins.get(binStart) ?? 0) + 1);
  }

  return [...bins.entries()]
    .sort(([a], [b]) => a - b)
    .map(([binStart, count]) => ({
      label: `${formatPriceShort(binStart)}–${formatPriceShort(binStart + width)}`,
      value: count,
      count,
    }));
}

export async function getMarketSnapshot(
  prisma: PrismaClient,
  zip: string
): Promise<{ bars: PriceBar[]; medianPrice: number | null }> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const rows = await prisma.property.findMany({
    where: { status: "Closed", listingType: "FOR_SALE", zip, closePrice: { not: null }, closeDate: { gte: since } },
    select: { closePrice: true },
  });

  const sales = rows.map((r) => ({ closePrice: r.closePrice as number }));
  const prices = sales.map((s) => s.closePrice).sort((a, b) => a - b);

  return {
    bars: buildPriceBars(sales),
    medianPrice: prices.length ? percentile(prices, 0.5) : null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web vitest run src/__tests__/lib/home-value-estimate.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: replace quarterly market snapshot with 90-day price histogram"
```

---

### Task 2: Component + route/page wiring

**Files:**
- Modify: `apps/web/src/components/home-value/LocalMarketSnapshot.tsx`
- Modify: `apps/web/src/app/(marketing)/home-value/page.tsx`
- Modify: `apps/web/src/app/api/home-value/estimate/route.ts` (verify only — no logic change expected)
- Test: `apps/web/src/__tests__/components/LocalMarketSnapshot.test.ts`

**Interfaces:**
- Consumes: `PriceBar` from Task 1 (`apps/web/src/lib/home-value-estimate.ts`).
- Produces: `LocalMarketSnapshot({ bars, medianPrice, zip }: { bars: PriceBar[]; medianPrice: number | null; zip: string })`.

- [ ] **Step 1: Write the failing test for the renamed field**

Replace `apps/web/src/__tests__/components/LocalMarketSnapshot.test.ts` entirely with:

```typescript
import { describe, it, expect } from "vitest";
import { computeBarHeights } from "@/components/home-value/LocalMarketSnapshot";

describe("computeBarHeights", () => {
  it("scales the tallest bar to 100", () => {
    const heights = computeBarHeights([{ value: 4 }, { value: 8 }, { value: 2 }]);
    expect(heights[1]).toBe(100);
  });

  it("scales other bars proportionally to the max", () => {
    const heights = computeBarHeights([{ value: 4 }, { value: 8 }]);
    expect(heights[0]).toBe(50);
  });

  it("returns all zeros when every bar has zero value, without dividing by zero", () => {
    const heights = computeBarHeights([{ value: 0 }, { value: 0 }]);
    expect(heights).toEqual([0, 0]);
  });

  it("handles a single bar", () => {
    expect(computeBarHeights([{ value: 5 }])).toEqual([100]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web vitest run src/__tests__/components/LocalMarketSnapshot.test.ts`
Expected: FAIL — `computeBarHeights` still reads `.count`, so passing `{ value }` objects produces `NaN`/`0` heights that don't match the expected values.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `apps/web/src/components/home-value/LocalMarketSnapshot.tsx` with:

```tsx
import type { PriceBar } from "@/lib/home-value-estimate";

export function computeBarHeights(bars: { value: number }[]): number[] {
  const max = Math.max(0, ...bars.map((b) => b.value));
  if (max === 0) return bars.map(() => 0);
  return bars.map((b) => Math.round((b.value / max) * 100));
}

interface Props {
  bars: PriceBar[];
  medianPrice: number | null;
  zip: string;
}

export function LocalMarketSnapshot({ bars, medianPrice, zip }: Props) {
  const heights = computeBarHeights(bars);

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Local Market Snapshot</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes sold by price in the last 90 days.
      </p>

      {bars.length === 0 ? (
        <p className="mt-8 text-sm text-[#1B1B1B]/60">
          No sales within 90 days in {zip}
        </p>
      ) : (
        <>
          <div className="mt-8 flex h-40 items-end gap-6">
            {bars.map((b, i) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end">
                  <div
                    className="w-full rounded-t bg-[#9E8C61]/70"
                    style={{ height: `${heights[i]}%` }}
                  />
                </div>
                <p className="text-xs text-[#1B1B1B]/60">{b.label}</p>
                {b.count != null && (
                  <p className="text-xs font-medium text-[#1B1B1B]">{b.count}</p>
                )}
              </div>
            ))}
          </div>

          {medianPrice != null && (
            <p className="mt-6 text-sm text-[#1B1B1B]/60">
              <span className="font-bold text-[#1B1B1B]">
                ${medianPrice.toLocaleString()}
              </span>{" "}
              median sold price in the last 90 days
            </p>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web vitest run src/__tests__/components/LocalMarketSnapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `page.tsx` to the new shape**

In `apps/web/src/app/(marketing)/home-value/page.tsx`:

Change the import (currently line 9-11 area):
```typescript
import { LocalMarketSnapshot, QuarterStat } from "@/components/home-value/LocalMarketSnapshot";
```
to:
```typescript
import { LocalMarketSnapshot } from "@/components/home-value/LocalMarketSnapshot";
import type { PriceBar } from "@/lib/home-value-estimate";
```

Change the `EstimateResponse` interface field:
```typescript
marketSnapshot: QuarterStat[];
```
to:
```typescript
marketSnapshot: { bars: PriceBar[]; medianPrice: number | null };
```

Change the render call:
```tsx
{data && <LocalMarketSnapshot quarters={data.marketSnapshot} />}
```
to:
```tsx
{data && (
  <LocalMarketSnapshot
    bars={data.marketSnapshot.bars}
    medianPrice={data.marketSnapshot.medianPrice}
    zip={zip}
  />
)}
```

- [ ] **Step 6: Verify `route.ts` needs no logic change**

Open `apps/web/src/app/api/home-value/estimate/route.ts` and confirm the `marketSnapshot,` field in the `NextResponse.json({...})` call (currently around line 95) still just passes through the `marketSnapshot` variable from `getMarketSnapshot(...)` unchanged — no edit needed here since it was already opaque to the shape.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors referencing `LocalMarketSnapshot.tsx`, `page.tsx`, `route.ts`, or `home-value-estimate.ts`.

- [ ] **Step 8: Live verification**

Start the dev server if not already running (`pnpm --filter web dev`), then use Puppeteer to load `/home-value` for a test address in a ZIP with 5+ recent sales (e.g. the `15595 Curtis Circle` / zip `95370` address used earlier this session) and confirm:
- The chart renders vertical bars labeled with price bands (e.g. "$650K–$750K") and a count under each.
- The subtitle reads "Homes sold by price in the last 90 days."
- The median line reads "$X median sold price in the last 90 days."

Then test a ZIP with no recent closed sales (or temporarily query one) and confirm the chart area shows "No sales within 90 days in {zip}" with the correct zip code substituted in.

- [ ] **Step 9: Run the full test suite**

Run: `pnpm --filter web vitest run`
Expected: all tests pass, no regressions in unrelated files.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/home-value/LocalMarketSnapshot.tsx apps/web/src/app/(marketing)/home-value/page.tsx apps/web/src/__tests__/components/LocalMarketSnapshot.test.ts
git commit -m "feat: wire 90-day price histogram into the home-value page"
```
