# Address Matching — Lat/Lng Fallback Tier Design

## Context

`findSubjectProperty` (`apps/web/src/lib/home-value-estimate.ts`) matches a
searched address against our DB through three sequential zip-scoped text
tiers: strict `contains`, suffix-dropped (handles "Circle" vs "Cir"), and
directional-abbreviated (handles "North" vs "N"). All three compare text.

Live-verified this session with a real case: DB stores `"18521 Woodham
Carne Rd"`, but Mapbox's geocoder only ever offers `"18521 Woodhams Carne
Road"` (extra "s") for that property — never the correct spelling, no
matter what's typed. All three existing tiers fail on this because the
mismatch is a mid-string spelling disagreement between two independent data
sources (Mapbox vs. CRMLS), not a formatting difference either tier is
built to handle.

Considered and rejected a house-number+zip-only fallback (matching on
house number within the same zip, ignoring street name entirely) — measured
a **10.2% collision rate** across the DB (14,221 of 139,238 zip+house-number
combinations have 2+ genuinely different streets sharing that number), which
would risk silently attaching the wrong property's beds/baths/sqft as an
"exact match" instead of correctly falling back to manual entry.

## Design

Add a **4th tier**, run only after all three existing text tiers return
zero matches: match by physical proximity instead of text, using the
lat/lng Mapbox already returns for whatever suggestion the user selected.

**Already available, no new plumbing needed for the data itself:**
`AddressAutocomplete`'s `AddressSuggestion` already carries `lat`/`lng`, and
`HomeValueTeaser.handleSelect` already passes them through as `lat`/`lng`
URL params to `/home-value`. They're just not read yet by
`apps/web/src/app/api/home-value/estimate/route.ts`'s `GET` handler or
passed to `findSubjectProperty` — that's the only new plumbing.

**Query shape:** still zip-scoped, same as the other three tiers (verified
this session: the densest single zip among all 2,385 in the DB has only
1,238 rows, average ~78/zip — cheap regardless of overall table size). Two
steps:
1. Bounding-box pre-filter: `latitude`/`longitude` within **±0.005 degrees**
   of the searched point (~550m at the box edges — 1 degree latitude is
   ~111,320m, so 0.005° ≈ 557m; using the same fixed delta for longitude is
   a deliberate overestimate at CA's latitudes, safely wider than the final
   radius in every direction so the box stage can't produce a false
   negative).
2. Exact Haversine distance calculation over the (small) box-filtered
   candidate set; keep only rows within a **100m** radius; if any remain,
   return them sorted by distance ascending (closest first), same return
   shape (`SubjectRecord[]`) as the other three tiers.

If the box-filtered/distance-filtered set is empty, return `[]` exactly as
today — falls through to manual entry, unchanged.

**Function signature change:** `findSubjectProperty(prisma, address, zip)`
becomes `findSubjectProperty(prisma, address, zip, lat, lng)`, with `lat`
and `lng` typed as `number | null` (the route already treats `address`/`zip`
as required but `lat`/`lng` as optional URL params today — if either is
missing or fails to parse, skip tier 4 and return `[]` at that point,
same as today's directional tier's early-return when no directional match
exists).

## Files touched (implementation, not part of this design doc)

- `apps/web/src/lib/home-value-estimate.ts` — add the 4th tier to
  `findSubjectProperty`; add a small pure `haversineDistanceMeters(lat1,
  lng1, lat2, lng2)` helper alongside it.
- `apps/web/src/app/api/home-value/estimate/route.ts` — read `lat`/`lng`
  from `searchParams`, pass through to `findSubjectProperty`.

## Testing

`haversineDistanceMeters` gets direct unit tests (known coordinate pairs
with known distances, e.g. two points ~100m apart vs. two points several
km apart). `findSubjectProperty`'s new tier gets unit tests following the
existing mocked-Prisma pattern in `home-value-estimate.test.ts`: strict/
suffix/directional all return empty, lat/lng candidates within radius are
returned sorted by distance; case with lat/lng present but no candidates
within radius returns `[]`; case with `lat`/`lng` both `null` skips tier 4
entirely and returns `[]` without an extra DB call.
