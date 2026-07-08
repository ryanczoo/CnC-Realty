# Home Value Estimator — Design Spec

**Date:** 2026-07-08
**Status:** Approved — parked for later (not being implemented yet)

---

## Overview

An in-house "instant home value" tool, inspired by Berkshire Hathaway HomeServices' BuySide-powered valuation report (`bhhs.com/sell-your-home`). Built entirely on CnC's own CRMLS data plus Mapbox geocoding — no paid third-party AVM, no Zillow/BuySide licensing.

A teaser section on `/sell` (positioned directly above `<FAQ />`) collects an address and routes to a new standalone report page. The report shows a value range, comparable sold listings, the subject property's own price history (if it has MLS history), and a local market snapshot — all free to view. The single precise point-estimate number is gated behind a name/email/phone submission, which creates a `Lead` in the CRM.

**What ships:**
- New `/sell` section (address input + 4 feature teasers, styled to match CnC's existing "Our Process"/"Our Values" title pattern)
- New `/home-value` report page (client-side geocoding, subject lookup, comps, chart, gated estimate)
- `ClosePrice`/`CloseDate` added to the IDX sync pipeline + `Property` schema (prerequisite — needed for real "sold" comps instead of last-list-price)
- New `HOME_VALUATION` `LeadSource` value
- Comps-based estimate: median $/sqft of matched sold comps × subject sqft, expressed as a range

**What is deferred:**
- Distance/recency/similarity-weighted comps (v2 accuracy improvement)
- Any regression/ML-based AVM
- Subject property photo/street view display
- Saving/re-visiting past estimate requests from a user account

---

## Section 1: Schema Changes (prerequisite)

### 1.1 `Property` model — add sold-price fields

```prisma
model Property {
  // ...existing fields...
  closePrice Float?
  closeDate  DateTime?
}
```

Migration required. Existing Closed-status rows will have `null` until the next full IDX resync backfills them (same operational pattern already used for prior field additions — e.g. `listAgentName`, `details`).

### 1.2 IDX sync — add RESO fields

`apps/web/src/lib/idx/client.ts` — add `"ClosePrice", "CloseDate"` to `SELECT_FIELDS`.

`apps/web/src/lib/idx/field-map.ts` — map `ClosePrice` → `closePrice`, `CloseDate` → `closeDate` in `mapResoToProperty`.

### 1.3 `LeadSource` enum — add value

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

No new field needed for the requested address — follows the existing `ContactForm` convention of pre-filling `notes` (e.g. `"Home value request for {address}."`).

---

## Section 2: `/sell` Page — Teaser Section

New component, placed in `sell/page.tsx` directly above `<FAQ />`.

**Layout** (matches CnC's existing section-title pattern — smaller top word + larger gold bottom word — not BHHS's serif style):
- Heading + one-line subheading
- Single address input with Mapbox-powered autocomplete (debounced ~400ms, matching the existing `useSearchFilters` pattern)
- Submit routes to `/home-value?address=<encoded address>`
- 4 feature teaser blocks in a 2×2 grid, icon + label + one-line description:
  1. **Our Estimate** — "Get a data-driven estimate based on real, local sales."
  2. **Comparable Sales** — "See what similar homes nearby have actually sold for."
  3. **Price History** — "See past sale dates and prices for your home."
  4. **Local Market Snapshot** — "See recent sale activity in your ZIP code."

Existing "Request Valuation" button/`PageCTA`/contact modal on `/sell` is untouched — this is a new, separate entry point.

---

## Section 3: `/home-value` Report Page — Flow

New route: `apps/web/src/app/(marketing)/home-value/page.tsx` (client component; reads `address` from the query string).

1. **Geocode** the address client-side via Mapbox Geocoding (`NEXT_PUBLIC_MAPBOX_TOKEN`, already in use elsewhere in the app) → lat/long + normalized address.
2. **Subject lookup** — query `Property` for an address match (normalized string match on address/city/zip).
   - **Match found:** auto-fill beds/baths/sqft/lot from our data. If the matched record(s) include past `Closed` entries at this address, populate the **Price History** panel.
   - **No match:** show a short inline form — beds, baths, sqft, lot size (optional) — before proceeding.
3. **Comps query** — `Property` where `status = "Closed"`, `closePrice` not null, same ZIP (or small lat/long bounding box), `closeDate` within the last ~6–12 months, roughly similar beds/sqft/property type.
4. **Compute estimate** — median `closePrice / sqft` across matched comps, multiplied by subject sqft; range expressed from the comps' $/sqft spread (e.g. 25th–75th percentile × subject sqft).
5. **Local Market Snapshot** — aggregate query over `Property` (same ZIP, `Closed`, last ~4 quarters): homes sold per quarter + median sold price, rendered as a simple bar chart.
6. **Render:**
   - Free: value range, comps list (reuses `PropertyCard`-style presentation), price history (if any), local market snapshot chart.
   - Gated: the single precise point estimate — blank/blurred with a "Get your exact estimate" form (name, email, phone) until submitted.

---

## Section 4: Estimate Methodology

**Chosen approach: median $/sqft of matched comps.**

- Filter comps: same ZIP, `Closed` status, `closePrice` present, sold within ~6–12 months, beds within ±1, sqft within roughly ±20%, matching `propertyType` where possible.
- If fewer than ~3 comps match, progressively widen the window (extend time range first, then radius/ZIP-adjacent, then bed tolerance) before falling back to a "not enough local data" state.
- `pricePerSqft = comp.closePrice / comp.sqft` for each comp; take the median.
- `pointEstimate = medianPricePerSqft * subject.sqft`.
- `range = [p25PricePerSqft * subject.sqft, p75PricePerSqft * subject.sqft]`.

**Rejected alternatives:**
- *Distance/recency/similarity-weighted average* — more accurate, still explainable, but adds real complexity (weighting/tuning) for a v1. Good candidate for a v2 iteration once the simple version is validated against real CMAs.
- *Regression/ML model trained on all closed CRMLS sales* — how real commercial AVMs work, but requires a training/versioning/retraining pipeline and risks garbage-in-garbage-out in low-inventory ZIPs. Out of scope for an in-house "simple" version.

---

## Section 5: API Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/home-value/estimate?address=&lat=&lng=&beds=&baths=&sqft=` | Runs subject lookup (if not already resolved client-side) + comps query + computes range + market snapshot. **Does not return the point estimate.** |
| POST | `/api/home-value/reveal` | Body: `{ firstName, lastName, email, phone, address, lat, lng, beds, baths, sqft }`. Creates a `Lead` (`source: HOME_VALUATION`, address in `notes`). Re-runs the same estimate calculation server-side and returns the point estimate only on success. |

The gate is enforced server-side — `/api/home-value/estimate` never includes the precise number in its response, so it can't be exposed by inspecting network requests before submitting the form.

---

## Section 6: Files Changed / Created

**Schema:**
- `packages/database/prisma/schema.prisma` — `Property.closePrice`, `Property.closeDate`, `LeadSource.HOME_VALUATION`
- New migration

**IDX:**
- `apps/web/src/lib/idx/client.ts` — add `ClosePrice`, `CloseDate` to `SELECT_FIELDS`
- `apps/web/src/lib/idx/field-map.ts` — map new fields

**Lib:**
- `apps/web/src/lib/home-value-estimate.ts` — comps matching + median $/sqft calculation, shared by both API routes

**API routes:**
- `apps/web/src/app/api/home-value/estimate/route.ts`
- `apps/web/src/app/api/home-value/reveal/route.ts`

**Components:**
- `apps/web/src/components/sell/HomeValueTeaser.tsx` — `/sell` page section
- `apps/web/src/components/home-value/AddressAutocomplete.tsx` — Mapbox-backed input, debounced
- `apps/web/src/components/home-value/ComparableSales.tsx`
- `apps/web/src/components/home-value/PriceHistory.tsx`
- `apps/web/src/components/home-value/LocalMarketSnapshot.tsx`
- `apps/web/src/components/home-value/RevealEstimateForm.tsx`

**Pages:**
- `apps/web/src/app/(marketing)/home-value/page.tsx`
- `apps/web/src/app/(marketing)/sell/page.tsx` — add `<HomeValueTeaser />` above `<FAQ />`

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Gate scope | Exact point estimate only | Range + comps + charts shown free; only the precise number requires signup — matches Ryan's explicit call |
| Comps accuracy | Add `ClosePrice`/`CloseDate` to IDX sync | CRMLS already has this data for free; using `ListPrice` as a stand-in for sold price would be materially misleading |
| Address coverage | DB match first, manual entry fallback | Covers off-market addresses (most homeowners' own homes) without any paid parcel-data API |
| Estimate method | Median $/sqft of matched comps | Transparent, explainable, zero new infrastructure; matches "simple in-house version" framing |
| Geocoding | Mapbox Geocoding, client-side | Already have the token; free tier (100k requests/mo) is far beyond realistic usage; debounced to control volume |
| Placement | New `/sell` section above `<FAQ />`, separate from existing "Request Valuation" CTA | Matches Ryan's reference screenshot; doesn't disturb the existing agent-driven contact flow |
| Gate enforcement | Server-side (point estimate never sent until Lead created) | A CSS-only gate would leak the number via network inspection |
