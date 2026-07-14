# Address Matching — Lat/Lng Fallback Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th, physical-proximity fallback tier to the home-value
page's address matching, so a Mapbox/MLS spelling disagreement (e.g.
"Woodham" vs "Woodhams" Carne Rd/Road) no longer forces a false
"needs manual entry" result.

**Architecture:** `findSubjectProperty` already tries three sequential
zip-scoped text tiers (strict, suffix-dropped, directional-abbreviated). A
new tier 4 runs only if all three fail: a zip-scoped lat/lng bounding-box
pre-filter, narrowed by an exact Haversine distance calculation, using
coordinates the frontend already captures from Mapbox but doesn't currently
send to this function.

**Tech Stack:** Prisma, Next.js API routes, Vitest.

## Global Constraints

- `lat`/`lng` are **optional** parameters on `findSubjectProperty` — every
  existing call site and all 9 existing tests call it with 3 args and must
  keep working unchanged; tier 4 must no-op (return `[]`, zero DB calls)
  when either is missing.
- Bounding-box pre-filter: `±0.005` degrees on both `latitude` and
  `longitude`.
- Final distance cutoff: `100` meters, via exact Haversine calculation.
- Tier 4 stays zip-scoped, same as tiers 1-3.
- Return shape stays `SubjectRecord[]` — `latitude`/`longitude` are used
  internally for distance sorting but never appear in the returned records
  (that interface doesn't include them today and must not change).

---

### Task 1: Haversine distance helper

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts`
- Test: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Produces: `haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number` — exported pure function. Task 2 depends on this.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/lib/home-value-estimate.test.ts` (new
`describe` block, can go near the top after the existing imports/describe
blocks):

```typescript
describe("haversineDistanceMeters", () => {
  it("computes ~111.2m for two points 0.001 degrees apart at the equator", () => {
    // R=6371000 (mean Earth radius) gives 111.195m per 0.001deg here, not
    // the commonly-quoted 111.32m/0.001deg figure (which uses a slightly
    // different reference radius) — assert what this formula actually
    // produces, not the rule-of-thumb number.
    const distance = haversineDistanceMeters(0, 0, 0, 0.001);
    expect(distance).toBeCloseTo(111.2, 1);
  });

  it("computes roughly 11km for two points 0.1 degrees apart at the equator", () => {
    const distance = haversineDistanceMeters(0, 0, 0, 0.1);
    expect(distance).toBeGreaterThan(11000);
    expect(distance).toBeLessThan(11200);
  });

  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceMeters(37.9586, -120.2830, 37.9586, -120.2830)).toBe(0);
  });
});
```

Add `haversineDistanceMeters` to the existing import line at the top of the
test file (find the line importing from `@/lib/home-value-estimate` and add
it to the destructured list).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/home-value-estimate.test.ts -t haversineDistanceMeters`
Expected: FAIL with `haversineDistanceMeters is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/home-value-estimate.ts`, add after the `percentile`
function (around line 45, before `computeEstimate`):

```typescript
const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/home-value-estimate.test.ts -t haversineDistanceMeters`
Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: add haversineDistanceMeters helper"
```

---

### Task 2: 4th tier in findSubjectProperty

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts`
- Modify: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Consumes: `haversineDistanceMeters` from Task 1.
- Produces: `findSubjectProperty(prisma, address, zip, lat?, lng?)` —
  signature gains two new optional trailing params. Task 3 (route wiring)
  depends on this new signature.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/lib/home-value-estimate.test.ts`, inside the
existing `describe("findSubjectProperty", ...)` block (add these as new
`it`s alongside the existing ones — do not remove or modify any existing
test in this block):

```typescript
  it("falls back to lat/lng proximity when all text tiers fail and returns the closest match within 100m", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const near = { mlsNumber: "ML-NEAR", status: "Active", beds: 4, baths: 2, sqft: 1800, lotSize: null, listPrice: 900000, closePrice: null, closeDate: null, listedAt: new Date(), propertyType: null, yearBuilt: null, county: null, photos: [], latitude: 37.95856776, longitude: -120.28303432 };
    const far = { mlsNumber: "ML-FAR", status: "Active", beds: 3, baths: 2, sqft: 1500, lotSize: null, listPrice: 700000, closePrice: null, closeDate: null, listedAt: new Date(), propertyType: null, yearBuilt: null, county: null, photos: [], latitude: 37.97, longitude: -120.30 };

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict
      .mockResolvedValueOnce([]) // suffix-dropped
      .mockResolvedValueOnce([near, far] as any); // proximity box query

    const result = await findSubjectProperty(prisma as any, "18521 Woodhams Carne Road", "95370", 37.95856776, -120.28303432);

    expect(result).toHaveLength(1);
    expect(result[0].mlsNumber).toBe("ML-NEAR");
  });

  it("strips latitude/longitude from the returned records", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const near = { mlsNumber: "ML-NEAR", status: "Active", beds: 4, baths: 2, sqft: 1800, lotSize: null, listPrice: 900000, closePrice: null, closeDate: null, listedAt: new Date(), propertyType: null, yearBuilt: null, county: null, photos: [], latitude: 37.95856776, longitude: -120.28303432 };

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([near] as any);

    const result = await findSubjectProperty(prisma as any, "18521 Woodhams Carne Road", "95370", 37.95856776, -120.28303432);

    expect(result[0]).not.toHaveProperty("latitude");
    expect(result[0]).not.toHaveProperty("longitude");
  });

  it("returns empty and makes no proximity query when lat/lng are omitted", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict
      .mockResolvedValueOnce([]); // suffix-dropped

    const result = await findSubjectProperty(prisma as any, "123 Main Street", "91101");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/home-value-estimate.test.ts -t findSubjectProperty`
Expected: the 3 new tests FAIL — either wrong result length/content (tier 4
doesn't exist yet) or a TypeScript error on the 4-arg/5-arg call (signature
doesn't accept `lat`/`lng` yet).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/home-value-estimate.ts`, replace the entire current
`findSubjectProperty` function (currently lines 104-157) with:

```typescript
const BOX_DELTA_DEGREES = 0.005;
const MAX_DISTANCE_METERS = 100;

async function findByProximity(
  prisma: PrismaClient,
  zip: string,
  lat?: number,
  lng?: number
): Promise<SubjectRecord[]> {
  if (lat == null || lng == null) return [];

  const nearby = await prisma.property.findMany({
    where: {
      zip,
      latitude: { gte: lat - BOX_DELTA_DEGREES, lte: lat + BOX_DELTA_DEGREES },
      longitude: { gte: lng - BOX_DELTA_DEGREES, lte: lng + BOX_DELTA_DEGREES },
    },
    orderBy: { listedAt: "desc" },
    select: { ...SUBJECT_SELECT, latitude: true, longitude: true },
  });

  return nearby
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      record: p,
      distance: haversineDistanceMeters(lat, lng, p.latitude as number, p.longitude as number),
    }))
    .filter(({ distance }) => distance <= MAX_DISTANCE_METERS)
    .sort((a, b) => a.distance - b.distance)
    .map(({ record }) => {
      const { latitude, longitude, ...rest } = record;
      return rest;
    });
}

export async function findSubjectProperty(
  prisma: PrismaClient,
  address: string,
  zip: string,
  lat?: number,
  lng?: number
): Promise<SubjectRecord[]> {
  const strict = await prisma.property.findMany({
    where: {
      zip,
      address: { contains: address, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
  });
  if (strict.length > 0) return strict;

  const words = address.trim().split(/\s+/);

  if (words.length >= 2) {
    // Geocoders spell street types out in full (e.g. "Circle") while MLS data
    // uses USPS abbreviations (e.g. "Cir") — retry without the trailing word so
    // "15595 Curtis Circle" still matches a stored "15595 Curtis Cir".
    const withoutSuffix = words.slice(0, -1).join(" ");

    const suffixDropped = await prisma.property.findMany({
      where: {
        zip,
        address: { contains: withoutSuffix, mode: "insensitive" },
      },
      orderBy: { listedAt: "desc" },
      select: SUBJECT_SELECT,
    });
    if (suffixDropped.length > 0) return suffixDropped;

    // Geocoders also spell directionals out in full (e.g. "North") while MLS
    // data abbreviates them (e.g. "N"). Unlike the suffix, a directional sits
    // mid-string (right after the house number), so it must be translated to
    // its abbreviation rather than dropped — dropping it wouldn't realign with
    // the abbreviated form still present in the stored address.
    const directional = DIRECTIONALS[words[1]?.toLowerCase()];
    if (directional) {
      // A 3-word address (number + directional + street name) has no suffix
      // word to drop; 4+ words means there's a real suffix beyond the street
      // name, same as the suffix-drop logic above.
      const rest = words.length > 3 ? words.slice(2, -1) : words.slice(2);
      const withDirectionalAbbreviated = [words[0], directional, ...rest].join(" ");

      const directionalMatch = await prisma.property.findMany({
        where: {
          zip,
          address: { contains: withDirectionalAbbreviated, mode: "insensitive" },
        },
        orderBy: { listedAt: "desc" },
        select: SUBJECT_SELECT,
      });
      if (directionalMatch.length > 0) return directionalMatch;
    }
  }

  // Tier 4: lat/lng proximity — catches cases where Mapbox and the MLS
  // disagree on street-name spelling in a way no text-based tier can
  // reconcile (e.g. "Woodham" vs "Woodhams" Carne Rd/Road).
  return findByProximity(prisma, zip, lat, lng);
}
```

This preserves the exact behavior of tiers 1-3 for every existing call
site (all 9 existing tests call with 3 args, so `lat`/`lng` are
`undefined`, and `findByProximity` short-circuits to `[]` with zero
additional DB calls before those tests' assertions run) — no existing test
in this file should need modification.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/home-value-estimate.test.ts`
Expected: PASS, all tests including the 3 new ones and all pre-existing
`findSubjectProperty` tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: add lat/lng proximity fallback tier to findSubjectProperty"
```

---

### Task 3: Wire lat/lng through the API route

**Files:**
- Modify: `apps/web/src/app/api/home-value/estimate/route.ts`
- Modify: `apps/web/src/__tests__/api/home-value-estimate.test.ts`

**Interfaces:**
- Consumes: the new `findSubjectProperty(prisma, address, zip, lat?, lng?)`
  signature from Task 2.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/api/home-value-estimate.test.ts`, inside the
existing `describe("GET /api/home-value/estimate", ...)` block:

```typescript
  it("passes lat/lng from query params through to the proximity fallback", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict
      .mockResolvedValueOnce([]) // suffix-dropped
      .mockResolvedValueOnce([
        {
          mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15,
          listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date(),
          latitude: 37.95856776, longitude: -120.28303432,
        },
      ] as any); // proximity match

    const res = await GET(makeRequest("address=123 Main Street&zip=91101&lat=37.95856776&lng=-120.28303432"));
    const body = await res.json();

    expect(body.subject.matched).toBe(true);
    const proximityCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(proximityCall.where.latitude.gte).toBeCloseTo(37.95356776, 5);
    expect(proximityCall.where.latitude.lte).toBeCloseTo(37.96356776, 5);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/home-value-estimate.test.ts -t "passes lat/lng"`
Expected: FAIL — `mock.calls[2]` is `undefined` (route doesn't read/pass
`lat`/`lng` yet, so `findSubjectProperty` never reaches tier 4, only 2
calls happen).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/app/api/home-value/estimate/route.ts`, the current lines
20-27 are:

```typescript
  const manualBeds = searchParams.get("beds") ? Number(searchParams.get("beds")) : null;
  const manualBaths = searchParams.get("baths") ? Number(searchParams.get("baths")) : null;
  const manualSqft = searchParams.get("sqft") ? Number(searchParams.get("sqft")) : null;
  const manualLotSize = searchParams.get("lotSize") ? Number(searchParams.get("lotSize")) : null;

  try {
    const matches = await findSubjectProperty(prisma, address, zip);
    const latest = matches[0] ?? null;
```

Replace with:

```typescript
  const manualBeds = searchParams.get("beds") ? Number(searchParams.get("beds")) : null;
  const manualBaths = searchParams.get("baths") ? Number(searchParams.get("baths")) : null;
  const manualSqft = searchParams.get("sqft") ? Number(searchParams.get("sqft")) : null;
  const manualLotSize = searchParams.get("lotSize") ? Number(searchParams.get("lotSize")) : null;
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : undefined;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : undefined;

  try {
    const matches = await findSubjectProperty(prisma, address, zip, lat, lng);
    const latest = matches[0] ?? null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/home-value-estimate.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `pnpm --filter web exec vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/home-value/estimate/route.ts apps/web/src/__tests__/api/home-value-estimate.test.ts
git commit -m "feat: read lat/lng query params and pass through to findSubjectProperty"
```
