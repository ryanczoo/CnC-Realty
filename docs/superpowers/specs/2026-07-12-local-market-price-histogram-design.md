# Local Market Snapshot — Price Histogram Design

## Context

`LocalMarketSnapshot` on `/home-value` currently shows homes sold per calendar
quarter over the trailing 4 quarters (~2 years). Root-cause investigation
(this session) confirmed CRMLS/Trestle only feeds closed-sale data for
roughly the trailing 90 days — the "0 sold" quarters Ryan noticed weren't a
bug, they're the honest reflection of a feed limitation. Rather than imply
2 years of history we don't have, we're replacing the quarterly chart with a
vertical bar chart of homes sold by price, scoped to the 90-day window
CRMLS actually gives us.

## Data

**Scope unchanged from today:** all `Closed` / `FOR_SALE` properties in the
subject ZIP with a non-null `closePrice`, no beds/propertyType filtering
(this stays a "what's happening broadly in your ZIP" view, distinct from the
narrower `comps` list used elsewhere on the page for the estimate itself).

**Window:** `closeDate >= now - 90 days` (flat window, not the quarter
boundaries used today).

## Three render states

**1. Zero sales (n = 0)**
Replace the chart area with: `No sales within 90 days in {zip}`. No median
line. Heading and subtitle stay.

**2. Sparse (1 ≤ n < 5)**
Binning into price bands doesn't hold up visually at n<5 — mostly-empty
bars misrepresent the data. Instead: one bar per sale, sorted by price
ascending, bar height proportional to that sale's price (not a count — at
this volume "count per bucket" is always 1 and carries no information).
Label under each bar is that sale's own price (e.g. "$725K"). No second
"count" line — there's nothing further to say per bar.

**3. Histogram (n ≥ 5)**
Bin into price bands, target ~5-6 bins. Bin width picked from a "nice
number" step table (10k, 25k, 50k, 100k, 250k, 500k, 1M, 2.5M, 5M — same
idea as D3's tick generation) so bands read as "$400K–$450K" rather than
ugly fractions. Bar height = count of sales in that band (this is the
literal "homes sold vs. price" chart Ryan asked for — vertical bars, price
bands along the X axis, count as height). Label under each bar: the price
band. Second line under each bar: the count, same layout as today's
quarter chart.

Both state 2 and state 3 reuse the existing generic `computeBarHeights`
(scales an array of `{count-or-value}` proportional to the max) — it
doesn't care what the numbers represent, so no change needed there.

## Other copy changes

- Subtitle: "Homes sold per quarter in your ZIP code." → "Homes sold by
  price in the last 90 days."
- Median callout: "$X median sold price in {quarter label}" → "$X median
  sold price in the last 90 days" (computed across all n sales in the
  window, shown whenever n ≥ 1).

## Files touched (implementation, not part of this design doc)

- `apps/web/src/lib/home-value-estimate.ts` — replace `getMarketSnapshot`'s
  quarter-grouping with the 90-day price-bucketing logic above; rename
  `QuarterStat` → `PriceBar` (shape changes meaningfully, old name would be
  misleading going forward).
- `apps/web/src/components/home-value/LocalMarketSnapshot.tsx` — consume
  the new shape; add the zero-state message; drop the "count" second line
  when in sparse (per-sale) mode.
- `apps/web/src/app/api/home-value/estimate/route.ts` — no logic change,
  just follows the renamed type.
- `apps/web/src/app/(marketing)/home-value/page.tsx` — same, follows the
  renamed type.

## Testing

Pure bucketing/binning logic (bin-width selection, per-sale vs. histogram
mode selection, median calc) gets TDD coverage in
`apps/web/src/__tests__/lib/home-value-estimate.test.ts`, same pattern as
the rest of that file. `.tsx` component changes are not unit-tested per
this project's established precedent (no jsdom/testing-library) — verified
live via Puppeteer instead.
