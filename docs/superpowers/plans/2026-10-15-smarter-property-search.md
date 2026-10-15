# Smarter Property Search + Apply-Button Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The three property search bars understand neighborhoods, counties, filler words, typed filters and loose
address spellings the way Zillow does, and every filter dropdown gets a Zillow-style Apply button, with a new
two-handle Price slider plus typeable Min/Max boxes.

**Architecture:** All text understanding stays in two pure, tested functions that already exist:
`buildPropertySearchParams` (text → URL filter params, used by all three bars) and `buildLocationWhere` (location →
Prisma `where`, used by the search page and `/api/properties`). A new `Property.area` column (MLS neighborhood label,
copied out of the `details` JSON) makes neighborhood search indexable. The five filter dropdowns become one shared
`FilterPanel` holding draft choices until Apply.

**Tech Stack:** Next.js 14, Prisma 5 / Neon Postgres (pg_trgm already installed), Tailwind, vitest (node env — UI logic
is tested through exported pure helpers, the repo's existing pattern).

**Spec:** `docs/superpowers/specs/2026-10-15-smarter-property-search-design.md`

## Global Constraints

- Zillow is the standard: only the behaviors listed in the spec. No typo correction, no nicknames, no MLS #, no exact-city-only.
- Desktop: nothing changes except the filter dropdown panels (Apply button, selected-dot indicator, new Price panel). Closed-state pages must be pixel-identical old vs new.
- Phone classes use `max-lg:` only; phone inputs ≥16px (`max-lg:text-base`) so iPhone doesn't zoom.
- Home-value bar (`components/home-value/*`, `lib/home-value-estimate.ts`) is not touched.
- Apply button: off-white `#F2F0EF` background, `#1B1B1B` text, full width at the bottom of each dropdown.
- Price slider steps: $25K to $1M, $100K to $2M, $250K to $5M, $1M to $10M+ (68 stops). Price pill label stays "Price".
- Bay Area = Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma.
- The dev/prod database is shared (Neon): migrations are hand-written SQL applied with `prisma migrate deploy` (never `migrate dev`, which can offer to reset). Applying a migration locally makes it live.
- Every task ends with: `cd apps/web && npx vitest run` (all pass) and `npx tsc --noEmit -p .` (clean). Tasks touching UI also run a full `next build` (this repo once broke the build while vitest+tsc stayed green).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nothing is pushed until Ryan says so (it ships together with the already-committed How to Join fix `4e5b21b`).

## Review Focus

1. Plain searches that work today ("Pasadena", "90210", "Pasadena, CA", a full MLS-spelled address) must still return at least the same homes — Task 6 live check compares old vs new counts.
2. Place names that contain a keyword must not be mangled: "Home Gardens", "Indio", "St Helena", "3 Bedford Ave" — tests in Tasks 3 and 4.
3. A dropdown closed without Apply must leave results unchanged — `draftChanges` tests (Task 8) + live click check (Task 10).
4. Price handles never cross, and a typed Min above Max is swapped on Apply rather than returning zero homes — Tasks 7 and 9.
5. Listings synced by the old production code between backfill and deploy must still get `area` — Task 11 re-runs the idempotent backfill after deploy.

---

### Task 1: `Property.area` column, sync mapping, backfill, indexes

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (model Property)
- Create: `packages/database/prisma/migrations/20261015120000_add_property_area/migration.sql`
- Create: `packages/database/prisma/migrations/20261015130000_index_property_area_county/migration.sql`
- Modify: `apps/web/src/lib/idx/field-map.ts` (return object)
- Test: `apps/web/src/__tests__/lib/field-map.test.ts`
- Create: `packages/database/backfill-property-area.mjs`

**Interfaces:**
- Produces: `Property.area: string | null` (Prisma field, used by Task 3's `where`), indexes `Property_area_trgm_idx`, `Property_county_idx`.

- [ ] **Step 1: Failing test** — append to `field-map.test.ts`:

```ts
describe("mapResoToProperty — area (MLS neighborhood)", () => {
  it("copies MLSAreaMajor into area", () => {
    const r = mapResoToProperty({ ...baseRaw(), MLSAreaMajor: "C21 - Silver Lake - Echo Park" } as any);
    expect(r.area).toBe("C21 - Silver Lake - Echo Park");
  });
  it("is null when the feed has no area", () => {
    expect(mapResoToProperty(baseRaw() as any).area).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `cd apps/web && npx vitest run src/__tests__/lib/field-map.test.ts` — Expected: FAIL (`area` undefined).

- [ ] **Step 3: Implement** — in `field-map.ts` return object, directly after `county: raw.CountyOrParish ?? null,` add:

```ts
    // MLS neighborhood label ("C21 - Silver Lake - Echo Park"), its own column
    // so search can index it; also kept inside details for the detail page.
    area: raw.MLSAreaMajor ?? null,
```

In `schema.prisma` model Property, after `county       String?` add `area         String?`, and after the
`Property_address_trgm_idx` line add:

```prisma
  @@index([county])
  @@index([area(ops: raw("gin_trgm_ops"))], type: Gin, map: "Property_area_trgm_idx")
```

`migrations/20261015120000_add_property_area/migration.sql`:

```sql
-- Nullable column: instant, no table rewrite.
ALTER TABLE "Property" ADD COLUMN "area" TEXT;
```

`migrations/20261015130000_index_property_area_county/migration.sql` (applied AFTER the backfill so the index builds once):

```sql
CREATE INDEX "Property_county_idx" ON "Property"("county");
CREATE INDEX "Property_area_trgm_idx" ON "Property" USING GIN ("area" gin_trgm_ops);
```

- [ ] **Step 4: Apply column + regenerate client** (no dev server running — it locks the Prisma DLL):

```bash
cd packages/database
mkdir -p /tmp/hold && mv prisma/migrations/20261015130000_index_property_area_county /tmp/hold/
npx prisma migrate deploy        # applies only 20261015120000
npx prisma generate
```
Expected: "1 migration applied", client generated.

- [ ] **Step 5: Run** the field-map test again — Expected: PASS.

- [ ] **Step 6: Backfill script** `packages/database/backfill-property-area.mjs`:

```js
// One-off, idempotent: copy details.MLSAreaMajor into Property.area in id order,
// 20k rows per statement so no long lock. Safe to re-run (only fills NULLs).
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const ENV_FILES = ["./.env", "../../apps/web/.env.local"];
function readEnv(key) {
  for (const rel of ENV_FILES) {
    const path = new URL(rel, import.meta.url);
    if (!existsSync(path)) continue;
    const hit = readFileSync(path, "utf8").replace(/\r/g, "")
      .match(new RegExp(`^\\s*${key}\\s*=\\s*["']?(.+?)["']?\\s*$`, "m"))?.[1];
    if (hit) return hit;
  }
}
process.env.DATABASE_URL = readEnv("DATABASE_URL");
const prisma = new PrismaClient();
const BATCH = 20000;
let after = "", filled = 0, batches = 0;
for (;;) {
  const [{ last }] = await prisma.$queryRawUnsafe(
    `SELECT max(id) AS last FROM (SELECT id FROM "Property" WHERE id > $1 ORDER BY id LIMIT ${BATCH}) b`, after);
  if (!last) break;
  filled += await prisma.$executeRawUnsafe(
    `UPDATE "Property" SET area = details->>'MLSAreaMajor'
     WHERE id > $1 AND id <= $2 AND area IS NULL AND details->>'MLSAreaMajor' IS NOT NULL`, after, last);
  after = last; batches++;
  if (batches % 20 === 0) console.log(`batch ${batches}, filled ${filled}`);
}
console.log(`done: ${batches} batches, filled ${filled}`);
await prisma.$disconnect();
```

- [ ] **Step 7: Run it** — `cd packages/database && node backfill-property-area.mjs` — Expected: ends `done: ~206 batches, filled ~3.5M+`. Then verify:

```bash
node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();(async()=>{console.log(await p.property.count({where:{area:{not:null}}}), await p.property.count({where:{status:{in:["Active","ComingSoon","ActiveUnderContract"]},area:{not:null}}}));await p.$disconnect()})()'
```
Expected: second number ≈ 192,000 (the active rows that have an area, measured 2026-10-15).

- [ ] **Step 8: Indexes** — `mv /tmp/hold/20261015130000_index_property_area_county prisma/migrations/ && npx prisma migrate deploy` — Expected: "1 migration applied". `npx prisma migrate status` — Expected: "Database schema is up to date".

- [ ] **Step 9: Full checks + commit**

```bash
cd apps/web && npx vitest run && npx tsc --noEmit -p .
cd ../.. && git add packages/database/prisma apps/web/src/lib/idx/field-map.ts apps/web/src/__tests__/lib/field-map.test.ts packages/database/backfill-property-area.mjs
git commit -m "feat(search): Property.area (MLS neighborhood) column, sync mapping, backfill, county/area indexes"
```

---

### Task 2: County list

**Files:**
- Create: `apps/web/src/lib/ca-counties.ts`
- Test: `apps/web/src/__tests__/lib/ca-counties.test.ts`

**Interfaces:**
- Produces: `CA_COUNTIES: readonly string[]` (58 names, exactly as stored in `Property.county`), `BAY_AREA_COUNTIES: readonly string[]` (9).

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { CA_COUNTIES, BAY_AREA_COUNTIES } from "@/lib/ca-counties";

describe("CA counties", () => {
  it("has all 58 California counties, spelled as the MLS stores them", () => {
    expect(CA_COUNTIES).toHaveLength(58);
    expect(CA_COUNTIES).toContain("Los Angeles");
    expect(CA_COUNTIES).toContain("San Luis Obispo");
    expect(CA_COUNTIES).toContain("Del Norte");
  });
  it("Bay Area is the standard nine, all real counties", () => {
    expect([...BAY_AREA_COUNTIES].sort()).toEqual(
      ["Alameda", "Contra Costa", "Marin", "Napa", "San Francisco", "San Mateo", "Santa Clara", "Solano", "Sonoma"]);
    for (const c of BAY_AREA_COUNTIES) expect(CA_COUNTIES).toContain(c);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/__tests__/lib/ca-counties.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/ca-counties.ts`:

```ts
// Spelled exactly as CRMLS stores Property.county (checked against the DB
// 2026-10-15), so a typed "Orange County" can match with a plain indexed equals.
export const CA_COUNTIES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte", "El Dorado",
  "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake", "Lassen", "Los Angeles",
  "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada",
  "Orange", "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino", "San Diego",
  "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara",
  "Santa Cruz", "Shasta", "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama",
  "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba",
] as const;

// Zillow's "Bay Area" region; the standard nine-county definition (Ryan, 2026-10-15).
export const BAY_AREA_COUNTIES = [
  "Alameda", "Contra Costa", "Marin", "Napa", "San Francisco", "San Mateo", "Santa Clara", "Solano", "Sonoma",
] as const;
```

- [ ] **Step 4: Run** the test — Expected: PASS. Commit:
`git add apps/web/src/lib/ca-counties.ts apps/web/src/__tests__/lib/ca-counties.test.ts && git commit -m "feat(search): California county + Bay Area lists"`

---

### Task 3: `buildLocationWhere` — addresses, counties, street + city, city-or-neighborhood

**Files:**
- Modify: `apps/web/src/lib/property-search-query.ts` (full rewrite below)
- Test: `apps/web/src/__tests__/lib/property-search-query.test.ts` (full rewrite below)

**Interfaces:**
- Consumes: `Property.area` (Task 1), `CA_COUNTIES`, `BAY_AREA_COUNTIES` (Task 2).
- Produces: `buildLocationWhere(raw: string): Prisma.PropertyWhereInput` (same signature; callers unchanged).

- [ ] **Step 1: Failing tests** — replace the test file with:

```ts
import { describe, it, expect } from "vitest";
import { buildLocationWhere } from "@/lib/property-search-query";

const ins = (contains: string) => ({ contains, mode: "insensitive" });
const place = (t: string) => ({ OR: [{ city: ins(t) }, { area: ins(t) }] });
const addr = (num: string, ...rest: object[]) => ({ AND: [{ address: { startsWith: `${num} `, mode: "insensitive" } }, ...rest] });

describe("buildLocationWhere", () => {
  describe("unchanged basics", () => {
    it("exact 5-digit zip", () => expect(buildLocationWhere("90210")).toEqual({ zip: "90210" }));
    it("number-only stays a plain address search", () => {
      expect(buildLocationWhere("1234")).toEqual({ address: ins("1234") });
      expect(buildLocationWhere("123456")).toEqual({ address: ins("123456") });
    });
    it("a city matches the city or the MLS neighborhood", () => {
      expect(buildLocationWhere("Anaheim")).toEqual(place("Anaheim"));
      expect(buildLocationWhere("Cerritos")).toEqual(place("Cerritos"));
    });
  });

  describe("city typed with a state", () => {
    it.each([
      ["monterey park, california", "monterey park"],
      ["monterey park, ca", "monterey park"],
      ["Los Angeles, CA", "Los Angeles"],
      ["Los Angeles CA", "Los Angeles"],
      ["Los Angeles, Calif.", "Los Angeles"],
      ["Pasadena, CA, USA", "Pasadena"],
      ["Pasadena, California, United States", "Pasadena"],
      ["  Monterey   Park ,  CA  ", "Monterey Park"],
    ])("%s → %s", (q, c) => expect(buildLocationWhere(q)).toEqual(place(c)));
    it("keeps a name that merely ends in the letters ca", () => expect(buildLocationWhere("Fonseca")).toEqual(place("Fonseca")));
    it("falls back to the raw text when only a state was typed", () => expect(buildLocationWhere("California")).toEqual(place("California")));
  });

  describe("zip inside a longer location", () => {
    it.each([
      ["Monterey Park CA 91754", "91754"],
      ["Monterey Park, CA 91754", "91754"],
      ["91754, CA", "91754"],
      ["Monterey Park 91754-1234", "91754"],
    ])("%s → zip %s", (q, z) => expect(buildLocationWhere(q)).toEqual({ zip: z }));
  });

  describe("addresses: house number + street name, street type ignored", () => {
    it.each([
      ["12802 Cantrece Street", addr("12802", { address: ins("Cantrece") })],
      ["328 N Lincoln Avenue", addr("328", { address: ins("Lincoln") })],
      ["328 North Lincoln Ave", addr("328", { address: ins("Lincoln") })],
      ["328 Lincoln Ave", addr("328", { address: ins("Lincoln") })],
      ["328 N. Lincoln Ave.", addr("328", { address: ins("Lincoln") })],
      ["1288 Glen Oaks Blvd", addr("1288", { address: ins("Glen Oaks") })],
      ["100 North Ave", addr("100", { address: ins("North") })],
      ["111 Marguerita Unit 100", addr("111", { address: ins("Marguerita") }, { address: ins("#100") })],
      ["111 Marguerita Ave #100", addr("111", { address: ins("Marguerita") }, { address: ins("#100") })],
      ["111 Marguerita Apt. 100", addr("111", { address: ins("Marguerita") }, { address: ins("#100") })],
      ["3 Bedford Ave", addr("3", { address: ins("Bedford") })],
    ])("%s", (q, where) => expect(buildLocationWhere(q)).toEqual(where));

    it("a city after a comma must match too (city or neighborhood)", () => {
      expect(buildLocationWhere("123 Main St, Monterey Park, CA")).toEqual(addr("123", { address: ins("Main") }, place("Monterey Park")));
      expect(buildLocationWhere("123 Main St, Monterey Park, CA 91754")).toEqual(addr("123", { address: ins("Main") }, place("Monterey Park")));
      expect(buildLocationWhere("12802 Cantrece Street, Cerritos")).toEqual(addr("12802", { address: ins("Cantrece") }, place("Cerritos")));
    });
  });

  describe("counties and Bay Area", () => {
    it.each([
      ["Orange County", "Orange"],
      ["orange county, ca", "Orange"],
      ["Los Angeles County", "Los Angeles"],
      ["San Luis Obispo County, California", "San Luis Obispo"],
    ])("%s → county %s", (q, c) => expect(buildLocationWhere(q)).toEqual({ county: c }));
    it("Bay Area → its nine counties", () => {
      const w = buildLocationWhere("Bay Area, CA") as { county: { in: string[] } };
      expect(w.county.in).toHaveLength(9);
      expect(w.county.in).toContain("Santa Clara");
    });
    it("an unknown county name falls back to a place search", () => expect(buildLocationWhere("Fake County")).toEqual(place("Fake County")));
  });

  describe("street + city, and street alone", () => {
    it("splits at the street type", () => {
      expect(buildLocationWhere("Atlantic Blvd Monterey Park")).toEqual({ AND: [{ address: ins("Atlantic") }, place("Monterey Park")] });
      expect(buildLocationWhere("Atlantic Blvd, Monterey Park, CA")).toEqual({ AND: [{ address: ins("Atlantic") }, place("Monterey Park")] });
      expect(buildLocationWhere("Main St Alhambra")).toEqual({ AND: [{ address: ins("Main") }, place("Alhambra")] });
    });
    it("text ending in a street type searches the street AND the place name", () => {
      expect(buildLocationWhere("Atlantic Blvd")).toEqual({ OR: [{ address: ins("Atlantic") }, { city: ins("Atlantic Blvd") }, { area: ins("Atlantic Blvd") }] });
      // a real LA neighborhood that ends in a street-type word
      expect(buildLocationWhere("Lake View Terrace")).toEqual({ OR: [{ address: ins("Lake View") }, { city: ins("Lake View Terrace") }, { area: ins("Lake View Terrace") }] });
    });
    it("a leading 'St' is a city word, not a street type", () => expect(buildLocationWhere("St Helena")).toEqual(place("St Helena")));
  });

  it("neighborhoods go through the same city-or-area match", () => {
    expect(buildLocationWhere("Silver Lake")).toEqual(place("Silver Lake"));
    expect(buildLocationWhere("Koreatown")).toEqual(place("Koreatown"));
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/__tests__/lib/property-search-query.test.ts` — Expected: FAIL (city cases return `{city}` not `{OR}`; address/county/street cases wrong).

- [ ] **Step 3: Implement** — replace `lib/property-search-query.ts` with:

```ts
import { Prisma } from "@cnc/database";
import { CA_COUNTIES, BAY_AREA_COUNTIES } from "@/lib/ca-counties";

// Trailing pieces people add the way Zillow/Google take a location
// ("Monterey Park, CA, USA"). None are stored on a listing, so they're dropped.
const COUNTRY_END = /(?:^|[\s,]+)(?:usa|united states(?: of america)?)$/i;
const STATE_END = /(?:^|[\s,]+)(?:ca|calif\.?|california)$/i;
const ZIP_END = /(?:^|[\s,]+)(\d{5})(?:-\d{4})?$/;
const ZIP_ONLY = /^\d{5}(?:-\d{4})?$/;

// Street types. Ignored when matching an address — listings spell them
// inconsistently ("Lincoln Avenue", "Marguerita Ave", "Sefton") — and used to
// split "Atlantic Blvd Monterey Park" into street + city.
const STREET_TYPES = new Set([
  "st", "street", "ave", "av", "avenue", "blvd", "boulevard", "rd", "road", "dr", "drive", "ln", "lane",
  "ct", "court", "pl", "place", "way", "ter", "terrace", "cir", "circle", "pkwy", "parkway", "hwy", "highway",
]);
const DIRECTIONS = new Set([
  "n", "s", "e", "w", "ne", "nw", "se", "sw",
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
]);
// "Unit 100", "Apt 100", "Ste 100", "#100" at the end; stored as "#100"
const UNIT_END = /(?:^|\s)(?:#|unit|apt|apartment|ste|suite)\s*#?\s*([a-z0-9-]+)$/i;

const insensitive = (contains: string) => ({ contains, mode: "insensitive" as const });

// A place name matches the city or the MLS neighborhood ("Silver Lake" is a
// neighborhood of the city "Los Angeles").
function cityOrArea(text: string): Prisma.PropertyWhereInput {
  return { OR: [{ city: insensitive(text) }, { area: insensitive(text) }] };
}

// Drops country/state, pulling out a trailing ZIP if there is one.
function stripRegion(s: string): { text: string; zip?: string } {
  let text = s.replace(COUNTRY_END, "");
  let zip: string | undefined;
  const takeZip = () => {
    const m = text.match(ZIP_END);
    if (m && !zip) { zip = m[1]; text = text.slice(0, m.index); }
  };
  takeZip();
  text = text.replace(STATE_END, "");
  takeZip();
  return { text: text.replace(/[\s,]+$/, "").trim(), zip };
}

// "328 North Lincoln Ave #4" → starts with "328 ", contains "Lincoln", contains "#4"
function addressWhere(street: string, city?: string): Prisma.PropertyWhereInput {
  let s = street.replace(/\./g, " ").replace(/\s+/g, " ").trim();
  let unit: string | undefined;
  const u = s.match(UNIT_END);
  if (u) { unit = u[1]; s = s.slice(0, u.index).trim(); }
  const [num, ...words] = s.split(" ");
  if (words.length && STREET_TYPES.has(words[words.length - 1].toLowerCase())) words.pop();
  if (words.length > 1 && DIRECTIONS.has(words[0].toLowerCase())) words.shift();
  if (!words.length && !unit && !city) return { address: insensitive(s) };
  const and: Prisma.PropertyWhereInput[] = [{ address: { startsWith: `${num} `, mode: "insensitive" } }];
  if (words.length) and.push({ address: insensitive(words.join(" ")) });
  if (unit) and.push({ address: insensitive(`#${unit}`) });
  if (city) and.push(cityOrArea(city));
  return { AND: and };
}

function placeWhere(place: string, cityHint?: string): Prisma.PropertyWhereInput {
  const lower = place.toLowerCase();
  if (lower === "bay area") return { county: { in: [...BAY_AREA_COUNTIES] } };
  const county = lower.match(/^(.+?) county$/);
  if (county) {
    const name = CA_COUNTIES.find((c) => c.toLowerCase() === county[1]);
    if (name) return { county: name };
  }
  const words = place.split(" ");
  const t = words.findIndex((w, i) => i > 0 && STREET_TYPES.has(w.toLowerCase()));
  if (t > 0) {
    const street = words.slice(0, t).join(" ");
    const city = words.slice(t + 1).join(" ") || cityHint;
    if (city) return { AND: [{ address: insensitive(street) }, cityOrArea(city)] };
    // "Atlantic Blvd" is a street, but "Lake View Terrace" is a neighborhood — search both
    return { OR: [{ address: insensitive(street) }, { city: insensitive(place) }, { area: insensitive(place) }] };
  }
  return cityOrArea(place);
}

export function buildLocationWhere(raw: string): Prisma.PropertyWhereInput {
  const q = raw.replace(/\s+/g, " ").trim();
  const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
  const first = parts[0] ?? q;

  if (ZIP_ONLY.test(first)) return { zip: first.slice(0, 5) };
  // "123 Main St, Monterey Park, CA" — the street, plus the city if given
  if (/^\d/.test(first) && parts.length > 1) {
    const city = stripRegion(parts.slice(1).join(", ")).text.split(",")[0].trim();
    return addressWhere(first, city || undefined);
  }

  const { text, zip } = stripRegion(q);
  if (zip) return { zip };
  const [place = "", cityHint] = text.split(",").map((s) => s.trim());
  if (!place) return cityOrArea(q);
  if (/^\d/.test(place)) return addressWhere(place);
  return placeWhere(place, cityHint || undefined);
}
```

- [ ] **Step 4: Run** the test file — Expected: PASS (all). Then full `npx vitest run` + `npx tsc --noEmit -p .` — Expected: green (route tests that mock prisma only check that a `where` is passed).

- [ ] **Step 5: Commit** — `git add apps/web/src/lib/property-search-query.ts apps/web/src/__tests__/lib/property-search-query.test.ts && git commit -m "feat(search): neighborhoods, counties, Bay Area, street+city, loose address spellings"`

---

### Task 4: `buildPropertySearchParams` — typed filters and filler words

**Files:**
- Modify: `apps/web/src/lib/property-search.ts` (full rewrite below)
- Test: `apps/web/src/lib/property-search.test.ts`

**Interfaces:**
- Produces: `buildPropertySearchParams(raw: string): URLSearchParams` — may set `query`, `minBeds`, `minBaths`, `minPrice`, `maxPrice`, `propertyType` (`"Condominium"` | `"Townhouse"`), `listingType` (`"FOR_RENT"` | `"FOR_SALE"`). Keys are only set when found; `query` is omitted when no location remains.

- [ ] **Step 1: Failing tests** — append inside the existing `describe` in `property-search.test.ts`:

```ts
  const p = (s: string) => Object.fromEntries(buildPropertySearchParams(s).entries());

  it("drops filler words around the city", () => {
    expect(p("Pasadena homes for sale")).toEqual({ query: "Pasadena", listingType: "FOR_SALE" });
    expect(p("homes for sale near Pasadena")).toEqual({ query: "Pasadena", listingType: "FOR_SALE" });
    expect(p("3 bed home in Whittier")).toEqual({ query: "Whittier", minBeds: "3" });
  });
  it("for rent switches the listing type", () => {
    expect(p("Pasadena homes for rent")).toEqual({ query: "Pasadena", listingType: "FOR_RENT" });
  });
  it("property type words", () => {
    expect(p("condos in Pasadena under 800k")).toEqual({ query: "Pasadena", propertyType: "Condominium", maxPrice: "800000" });
    expect(p("townhomes in pasadena")).toEqual({ query: "pasadena", propertyType: "Townhouse" });
  });
  it("prices", () => {
    expect(p("Pasadena under 1M")).toEqual({ query: "Pasadena", maxPrice: "1000000" });
    expect(p("over 1m")).toEqual({ minPrice: "1000000" });
    expect(p("between 500k and 800k")).toEqual({ minPrice: "500000", maxPrice: "800000" });
    expect(p("between 500 and 800k")).toEqual({ minPrice: "500000", maxPrice: "800000" });
    expect(p("homes under $1.5M in Glendale")).toEqual({ query: "Glendale", maxPrice: "1500000" });
    expect(p("under 750,000")).toEqual({ maxPrice: "750000" });
  });
  it("beds and baths shorthand", () => {
    expect(p("3br in Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("3 bd Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("3 bedroom homes in Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("2 bath homes in Pasadena")).toEqual({ query: "Pasadena", minBaths: "2" });
  });
  it("leaves place names and addresses that contain keywords alone", () => {
    expect(p("Home Gardens")).toEqual({ query: "Home Gardens" });
    expect(p("Indio")).toEqual({ query: "Indio" });
    expect(p("3 Bedford Ave")).toEqual({ query: "3 Bedford Ave" });
    expect(p("123 Main St")).toEqual({ query: "123 Main St" });
  });
```

- [ ] **Step 2: Run** `npx vitest run src/lib/property-search.test.ts` — Expected: FAIL on the new cases (old cases still pass).

- [ ] **Step 3: Implement** — replace `lib/property-search.ts` with:

```ts
// Reads what people type into the homepage, Buy page and search-page bars the
// way Zillow does ("condos in Pasadena under 800k", "3br", "for rent") and turns
// it into the filter params the search page already understands. Whatever is
// left is the location, handed to buildLocationWhere on the server.
const AMOUNT = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|mil|million)?\b`;
const BETWEEN = new RegExp(String.raw`\bbetween\s+${AMOUNT}\s+(?:and|to)\s+${AMOUNT}`, "i");
const UNDER = new RegExp(String.raw`\b(?:under|below|less than|up to|max)\s+${AMOUNT}`, "i");
const OVER = new RegExp(String.raw`\b(?:over|above|more than|at least|min)\s+${AMOUNT}`, "i");
const BEDS = /\b(\d+)\s*-?\s*(?:bedrooms?|beds?|bdrms?|bds?|brs?)\b/i;
const BATHS = /\b(\d+(?:\.5)?)\s*-?\s*(?:bathrooms?|baths?|ba)\b/i;
const RENT = /\b(?:for\s+(?:rent|lease)|rentals?)\b/i;
const SALE = /\bfor\s+sale\b/i;
const CONDO = /\bcondo(?:minium)?s?\b/i;
const TOWNHOUSE = /\btown\s?(?:home|house)s?\b/i;
const FILLER = /\b(?:homes|houses|house|properties|listings|real estate|apartments|with)\b/gi;
// Singular "home" only where it can't be a place name ("Home Gardens")
const HOME = /\bhome\b(?=\s+(?:in|near|around|for)\b|\s*$)/gi;
const LEAD = /^(?:in|near|around)\s+/i;
const TRAIL = /\s+(?:in|near|around)$/i;

function toDollars(n: string, unit?: string): number | null {
  const v = parseFloat(n.replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  if (!unit) return v >= 1000 ? Math.round(v) : null; // a bare "800" isn't a price
  return Math.round(v * (unit.toLowerCase() === "k" ? 1_000 : 1_000_000));
}

export function buildPropertySearchParams(raw: string): URLSearchParams {
  const params = new URLSearchParams();
  let t = ` ${raw} `;
  // Removes the matched phrase only when `use` accepts it
  const cut = (re: RegExp, use: (m: RegExpMatchArray) => boolean) => {
    const m = t.match(re);
    if (m && use(m)) t = `${t.slice(0, m.index)} ${t.slice(m.index! + m[0].length)}`;
  };

  cut(BETWEEN, (m) => {
    const lo = toDollars(m[1], m[2] ?? m[4]), hi = toDollars(m[3], m[4]);
    if (!lo || !hi) return false;
    params.set("minPrice", String(lo)); params.set("maxPrice", String(hi)); return true;
  });
  cut(UNDER, (m) => { const v = toDollars(m[1], m[2]); if (!v) return false; params.set("maxPrice", String(v)); return true; });
  cut(OVER, (m) => { const v = toDollars(m[1], m[2]); if (!v) return false; params.set("minPrice", String(v)); return true; });
  cut(BEDS, (m) => { params.set("minBeds", m[1]); return true; });
  cut(BATHS, (m) => { params.set("minBaths", m[1]); return true; });
  cut(RENT, () => { params.set("listingType", "FOR_RENT"); return true; });
  cut(SALE, () => { params.set("listingType", "FOR_SALE"); return true; });
  cut(CONDO, () => { params.set("propertyType", "Condominium"); return true; });
  cut(TOWNHOUSE, () => { params.set("propertyType", "Townhouse"); return true; });

  const location = t.replace(FILLER, " ").replace(HOME, " ").replace(/\s+/g, " ").trim()
    .replace(LEAD, "").replace(TRAIL, "").trim();
  if (location) params.set("query", location);
  return params;
}
```

- [ ] **Step 4: Run** the test file — Expected: PASS, including the six original cases. Full `npx vitest run` + tsc — green.

- [ ] **Step 5: Commit** — `git add apps/web/src/lib/property-search.ts apps/web/src/lib/property-search.test.ts && git commit -m "feat(search): typed price, beds/baths shorthand, condo/townhome, for rent, filler words"`

---

### Task 5: Results-page bar applies every typed filter

**Files:**
- Modify: `apps/web/src/lib/search-filters.ts`
- Test: `apps/web/src/__tests__/lib/search-filters.test.ts`
- Modify: `apps/web/src/components/properties/FilterBar.tsx` (`submitQuery` only)

**Interfaces:**
- Consumes: `buildPropertySearchParams` (Task 4).
- Produces: `parsedToFilterPatch(params: URLSearchParams): Partial<SearchFilters>`.

(The homepage and Buy bars already push every param from `buildPropertySearchParams` to `/properties`; the search page and `/api/properties` already read `minPrice`/`maxPrice`/`minBaths`/`propertyType`/`listingType`. Only the results-page bar dropped everything but `minBeds`.)

- [ ] **Step 1: Failing test** — append to `search-filters.test.ts`:

```ts
import { parsedToFilterPatch } from "@/lib/search-filters";
import { buildPropertySearchParams } from "@/lib/property-search";

describe("parsedToFilterPatch", () => {
  const patch = (s: string) => parsedToFilterPatch(buildPropertySearchParams(s));
  it("carries every typed filter", () => {
    expect(patch("condos in Pasadena under 800k")).toEqual({ query: "Pasadena", propertyType: "Condominium", minPrice: "", maxPrice: "800000" });
    expect(patch("Pasadena homes for rent")).toEqual({ query: "Pasadena", listingType: "FOR_RENT" });
  });
  it("a plain location leaves the other filters as they are (Zillow keeps them)", () => {
    expect(patch("Pasadena")).toEqual({ query: "Pasadena" });
  });
  it("a typed price replaces both ends", () => {
    expect(patch("over 1m")).toEqual({ query: "", minPrice: "1000000", maxPrice: "" });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/__tests__/lib/search-filters.test.ts` — Expected: FAIL (not exported).

- [ ] **Step 3: Implement** — append to `lib/search-filters.ts`:

```ts
const PARSED_KEYS = ["minBeds", "minBaths", "propertyType", "listingType"] as const;

// Typed text → the filters to change. Only what was typed changes; a typed
// price sets both ends so an old min can't sit above a newly typed max.
export function parsedToFilterPatch(params: URLSearchParams): Partial<SearchFilters> {
  const patch: Partial<SearchFilters> = { query: params.get("query") ?? "" };
  for (const k of PARSED_KEYS) {
    const v = params.get(k);
    if (v) patch[k] = v;
  }
  if (params.has("minPrice") || params.has("maxPrice")) {
    patch.minPrice = params.get("minPrice") ?? "";
    patch.maxPrice = params.get("maxPrice") ?? "";
  }
  return patch;
}
```

In `FilterBar.tsx` add `import { parsedToFilterPatch } from "@/lib/search-filters";` and replace the body of `submitQuery` with:

```ts
    applyFilters(parsedToFilterPatch(buildPropertySearchParams(queryDraft)));
```
(keep the existing comment above it).

- [ ] **Step 4: Run** test + full suite + tsc — green. Commit:
`git add apps/web/src/lib/search-filters.ts apps/web/src/__tests__/lib/search-filters.test.ts apps/web/src/components/properties/FilterBar.tsx && git commit -m "feat(search): results-page bar applies every typed filter"`

---

### Task 6: Release-1 verification (typed search)

**Files:**
- Create: `.superpowers/pf-survey/searchMatrixPF.cjs` (git-ignored tooling)

- [ ] **Step 1: Builds** — old = `git worktree add ../bpf-s1 4e5b21b` (copy `apps/web/.env.local`, `pnpm install --frozen-lockfile --prefer-offline`, `pnpm --filter @cnc/database exec prisma generate`); `next build` both; `diff` the route-size tables. Expected: identical except `/properties` and `/` `/buy` may grow by < 1 kB (parser). Start old on 3100, new on 3101 (`./node_modules/.bin/next start -p …`).

- [ ] **Step 2: Live matrix** — `searchMatrixPF.cjs` holds a table of `[typed text, params]` rows (params exactly as the Task 4 tests produce, e.g. `["condos in Pasadena under 800k", "query=Pasadena&propertyType=Condominium&maxPrice=800000"]`), calls `/api/properties?<params>&limit=1&v=<random>` on 3100 and 3101 (the random param bypasses the shared 5-min Redis cache), and prints old/new totals per row.
Expected: every row in the spec table returns > 0 on new; "Pasadena", "90210", "Pasadena, CA", "monterey park, california", "111 Marguerita #100, Monterey Park, CA 91754" return new ≥ old; "Silver Lake" ≥ 500; "Koreatown" ≥ 60; "Orange County" ≈ 12,000; "Bay Area" > 0; "328 North Lincoln Ave" = 1.

- [ ] **Step 3: Search speed** — time 5 uncached calls each for "Pasadena", "Silver Lake", "Orange County", "328 Lincoln Ave", "Atlantic Blvd Monterey Park" on 3100 vs 3101. Expected: new within noise of old's "Pasadena" (≈0.1–0.2 s). If any is > 2× old, run `EXPLAIN` on its query and stop to report.

- [ ] **Step 4: Desktop unchanged** — `node abPF.cjs 3100 3101 s1` (homepage, Buy, Sell, Join, Rent views). Expected: all identical (only text parsing changed).

- [ ] **Step 5: Page speed** — `SPD_PAGES="/,/buy,/properties?query=pasadena" node speedPF.cjs 3100 desktop old` / `3101 … new`, same for `phone`. Expected: equal script counts, comparable load times.

- [ ] **Step 6: Home value unaffected** — `curl` `/api/home-value/estimate` for the Woodham test address on both ports (same params as the 2026-07-13 check). Expected: identical JSON.

- [ ] **Step 7:** Stop both servers (also kill child `node` on 3100/3101 via `Get-NetTCPConnection` + `Stop-Process`), remove the worktree. No commit (tooling is git-ignored).

---

### Task 7: Price step list

**Files:**
- Create: `apps/web/src/lib/price-steps.ts`
- Test: `apps/web/src/__tests__/lib/price-steps.test.ts`

**Interfaces:**
- Produces: `PRICE_STEPS: readonly number[]`, `LAST_STEP: number` (67), `minIndexFor(value: string): number`, `maxIndexFor(value: string): number`, `minValueAt(i: number): string`, `maxValueAt(i: number): string`, `stepLabel(i: number): string`, `normalizePriceDraft(min: string, max: string): { minPrice: string; maxPrice: string }`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { PRICE_STEPS, LAST_STEP, minIndexFor, maxIndexFor, minValueAt, maxValueAt, stepLabel, normalizePriceDraft } from "@/lib/price-steps";

describe("price steps", () => {
  it("$25K to $1M, $100K to $2M, $250K to $5M, $1M to $10M", () => {
    expect(PRICE_STEPS).toHaveLength(68);
    expect(LAST_STEP).toBe(67);
    expect(PRICE_STEPS.slice(0, 3)).toEqual([0, 25_000, 50_000]);
    expect(PRICE_STEPS[40]).toBe(1_000_000);
    expect(PRICE_STEPS[41]).toBe(1_100_000);
    expect(PRICE_STEPS[51]).toBe(2_250_000);
    expect(PRICE_STEPS[63]).toBe(6_000_000);
    expect(PRICE_STEPS[67]).toBe(10_000_000);
  });
  it("labels", () => {
    expect([0, 1, 40, 41, 51, 67].map(stepLabel)).toEqual(["$0", "$25K", "$1M", "$1.1M", "$2.25M", "$10M+"]);
  });
  it("ends mean 'no limit'", () => {
    expect(minValueAt(0)).toBe("");
    expect(maxValueAt(LAST_STEP)).toBe("");
    expect(minIndexFor("")).toBe(0);
    expect(maxIndexFor("")).toBe(LAST_STEP);
  });
  it("a typed amount puts the handle on the nearest step inside the range", () => {
    expect(minIndexFor("812500")).toBe(32); // $800K
    expect(maxIndexFor("812500")).toBe(33); // $825K
    expect(maxIndexFor("20000000")).toBe(LAST_STEP);
    expect(minValueAt(32)).toBe("800000");
  });
  it("a typed min above max is swapped, not left to return nothing", () => {
    expect(normalizePriceDraft("900000", "500000")).toEqual({ minPrice: "500000", maxPrice: "900000" });
    expect(normalizePriceDraft("500000", "")).toEqual({ minPrice: "500000", maxPrice: "" });
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/price-steps.ts`:

```ts
// Stops for the Price slider: fine steps where most homes are, coarser above.
// Zillow uses the same small-then-larger pattern (57 stops; ours 68).
const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const PRICE_STEPS: readonly number[] = [
  ...range(0, 1_000_000, 25_000),
  ...range(1_100_000, 2_000_000, 100_000),
  ...range(2_250_000, 5_000_000, 250_000),
  ...range(6_000_000, 10_000_000, 1_000_000),
];
export const LAST_STEP = PRICE_STEPS.length - 1; // means "$10M+", no max

export function minIndexFor(value: string): number {
  const v = Number(value);
  if (!value || !Number.isFinite(v) || v <= 0) return 0;
  let i = 0;
  while (i < LAST_STEP && PRICE_STEPS[i + 1] <= v) i++;
  return i;
}

export function maxIndexFor(value: string): number {
  const v = Number(value);
  if (!value || !Number.isFinite(v)) return LAST_STEP;
  const i = PRICE_STEPS.findIndex((s) => s >= v);
  return i === -1 ? LAST_STEP : i;
}

export const minValueAt = (i: number) => (i <= 0 ? "" : String(PRICE_STEPS[i]));
export const maxValueAt = (i: number) => (i >= LAST_STEP ? "" : String(PRICE_STEPS[i]));

export function stepLabel(i: number): string {
  if (i >= LAST_STEP) return "$10M+";
  const n = PRICE_STEPS[i];
  if (n === 0) return "$0";
  return n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(2)}M` : `$${n / 1_000}K`;
}

export function normalizePriceDraft(min: string, max: string): { minPrice: string; maxPrice: string } {
  if (min && max && Number(min) > Number(max)) return { minPrice: max, maxPrice: min };
  return { minPrice: min, maxPrice: max };
}
```

- [ ] **Step 4: Run** — PASS. Commit: `git add apps/web/src/lib/price-steps.ts apps/web/src/__tests__/lib/price-steps.test.ts && git commit -m "feat(filters): price slider step list"`

---

### Task 8: Shared `FilterPanel` + Apply on all five dropdowns

**Files:**
- Create: `apps/web/src/lib/filter-draft.ts`
- Test: `apps/web/src/__tests__/lib/filter-draft.test.ts`
- Create: `apps/web/src/components/properties/FilterPanel.tsx`
- Modify: `apps/web/src/components/properties/FilterBar.tsx`

**Interfaces:**
- Consumes: `normalizePriceDraft` (Task 7).
- Produces: `FilterDraft = Partial<SearchFilters>`, `draftValue(draft, filters, key): string`, `draftChanges(draft, filters): FilterDraft`; components `FilterPanel({ width, onApply, children })`, `FilterOption({ selected, onClick, children })`.

- [ ] **Step 1: Failing test** `filter-draft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { draftValue, draftChanges } from "@/lib/filter-draft";
import { DEFAULT_FILTERS } from "@/types/property";

const filters = { ...DEFAULT_FILTERS, query: "Pasadena", minBeds: "2" };

describe("filter draft", () => {
  it("shows the draft pick, else the applied filter", () => {
    expect(draftValue({}, filters, "minBeds")).toBe("2");
    expect(draftValue({ minBeds: "3" }, filters, "minBeds")).toBe("3");
    expect(draftValue({ minBeds: "" }, filters, "minBeds")).toBe("");
  });
  it("Apply sends only real changes", () => {
    expect(draftChanges({ minBeds: "3" }, filters)).toEqual({ minBeds: "3" });
    expect(draftChanges({ minBeds: "2" }, filters)).toEqual({});
    expect(draftChanges({ minBeds: "" }, filters)).toEqual({ minBeds: "" });
  });
  it("closing without Apply = an empty draft = no change", () => {
    expect(draftChanges({}, filters)).toEqual({});
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/filter-draft.ts`:

```ts
import type { SearchFilters } from "@/types/property";

// Choices made inside an open filter dropdown, held until Apply (Zillow-style).
export type FilterDraft = Partial<SearchFilters>;

export function draftValue(draft: FilterDraft, filters: SearchFilters, key: keyof SearchFilters): string {
  return draft[key] ?? filters[key];
}

export function draftChanges(draft: FilterDraft, filters: SearchFilters): FilterDraft {
  const out: FilterDraft = {};
  for (const k of Object.keys(draft) as (keyof SearchFilters)[]) {
    const v = draft[k];
    if (v !== undefined && v !== filters[k]) out[k] = v;
  }
  return out;
}
```

`components/properties/FilterPanel.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

// One frame for every filter dropdown — a drop-down under the pill on desktop,
// a slide-up sheet on phones (same classes the five copies used before) — with
// Zillow's Apply button at the bottom.
const FRAME =
  "absolute left-0 top-full z-40 mt-1 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:mt-0 max-lg:w-auto max-lg:rounded-b-none max-lg:rounded-t-2xl max-lg:max-h-[75svh] max-lg:overflow-y-auto max-lg:py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]";

export function FilterPanel({ width, onApply, children }: { width: string; onApply: () => void; children: ReactNode }) {
  return (
    <div className={`${FRAME} ${width}`}>
      {children}
      <div className="px-3 pb-1 pt-2">
        <button
          type="button"
          onClick={onApply}
          className="w-full rounded-full bg-[#F2F0EF] py-2 text-sm font-medium text-[#1B1B1B] transition-opacity hover:opacity-90 max-lg:py-3 max-lg:text-base"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function FilterOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm max-lg:py-3 max-lg:text-base hover:bg-white/5 ${
        selected ? "text-[#9E8C61]" : "text-white/70 hover:text-white"
      }`}
    >
      <span className={`h-2 w-2 rounded-full border ${selected ? "border-[#9E8C61] bg-[#9E8C61]" : "border-white/30"}`} />
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Rewire `FilterBar.tsx`:**
  - Imports: add `import { FilterPanel, FilterOption } from "./FilterPanel";`, `import { draftChanges, draftValue, type FilterDraft } from "@/lib/filter-draft";`, `import { normalizePriceDraft } from "@/lib/price-steps";`; remove `useIsMobile` import.
  - Destructure `{ filters, applyFilters, clearFilters, hasActiveFilters, total }` (keep `setFilter` in `Props` — `SearchResults` still passes it).
  - Replace the `isMobile` Escape effect with one for all sizes (Escape = close without Apply):

```ts
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenDropdown(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openDropdown]);
```
  - Add draft state + helpers after `openDropdown`:

```ts
  // Picks inside an open dropdown wait for Apply; opening starts a fresh draft,
  // so closing any other way (outside tap, Escape, another pill) discards it.
  const [draft, setDraft] = useState<FilterDraft>({});
  const dv = (k: keyof SearchFilters) => draftValue(draft, filters, k);
  const pick = (patch: FilterDraft) => setDraft((d) => ({ ...d, ...patch }));
  function apply() {
    let next = draft;
    if ("minPrice" in draft || "maxPrice" in draft) next = { ...draft, ...normalizePriceDraft(dv("minPrice"), dv("maxPrice")) };
    const changes = draftChanges(next, filters);
    if (Object.keys(changes).length) applyFilters(changes);
    setOpenDropdown(null);
  }
```
  - `toggle` becomes: `setDraft({}); setOpenDropdown((prev) => (prev === key ? null : key));`
  - Each dropdown body becomes a `FilterPanel` with `FilterOption`s, e.g. Beds:

```tsx
        {openDropdown === "beds" && (
          <FilterPanel width="w-32" onApply={apply}>
            {BED_OPTIONS.map((o) => (
              <FilterOption key={o.value} selected={dv("minBeds") === o.value} onClick={() => pick({ minBeds: o.value })}>
                {o.label}
              </FilterOption>
            ))}
          </FilterPanel>
        )}
```
    Same for For Sale/Rent (`width="w-36"`, key `listingType`), Baths (`w-32`, `minBaths`), Type (`w-44`, `propertyType`). Price keeps the preset list for now (`width="w-44"`, `selected={dv("minPrice") === p.min && dv("maxPrice") === p.max}`, `onClick={() => pick({ minPrice: p.min, maxPrice: p.max })}`) — Task 9 replaces it.
  - Pill labels/active states keep reading `filters` (applied values), so pills only change after Apply.

- [ ] **Step 5: Run** filter-draft test, full suite, tsc, and `next build` — all green.

- [ ] **Step 6: Commit** — `git add apps/web/src/lib/filter-draft.ts apps/web/src/__tests__/lib/filter-draft.test.ts apps/web/src/components/properties/FilterPanel.tsx apps/web/src/components/properties/FilterBar.tsx && git commit -m "feat(filters): shared FilterPanel, Apply button in all five dropdowns"`

---

### Task 9: Price dropdown — two-handle slider + Min/Max boxes

**Files:**
- Create: `apps/web/src/components/properties/PriceRangeFilter.tsx`
- Modify: `apps/web/src/components/properties/FilterBar.tsx` (price panel; remove `PRICE_PRESETS` and `priceLabel`)

**Interfaces:**
- Consumes: Task 7 helpers; `digitsOnly`, `formatWithCommas` from `lib/form-validation.ts` (the whole-dollar siblings of the currency helpers the spec names); `FilterPanel` (Task 8).
- Produces: `PriceRangeFilter({ min, max, onChange(min: string, max: string) })`.

- [ ] **Step 1: Implement** `PriceRangeFilter.tsx`:

```tsx
"use client";

import { digitsOnly, formatWithCommas } from "@/lib/form-validation";
import { LAST_STEP, maxIndexFor, maxValueAt, minIndexFor, minValueAt, stepLabel } from "@/lib/price-steps";

interface Props {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}

// Two standard range inputs stacked on one track; only their thumbs take
// pointer/touch events, so each handle drags on its own (no slider library).
const RANGE =
  "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#F2F0EF] [&::-webkit-slider-thumb]:bg-[#9E8C61] " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#F2F0EF] [&::-moz-range-thumb]:bg-[#9E8C61]";

export function PriceRangeFilter({ min, max, onChange }: Props) {
  const lo = minIndexFor(min);
  const hi = Math.max(lo, maxIndexFor(max));
  const pct = (i: number) => (i / LAST_STEP) * 100;
  return (
    <div className="px-4 pb-1 pt-3">
      <div className="mb-2 flex justify-between text-xs text-white/50">
        <span>{stepLabel(lo)}</span>
        <span>{stepLabel(hi)}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#9E8C61]"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range" aria-label="Minimum price" min={0} max={LAST_STEP} step={1} value={lo}
          onChange={(e) => onChange(minValueAt(Math.min(Number(e.target.value), hi)), max)}
          className={RANGE}
          // When both handles sit at the top end, the min handle must be on top to be draggable
          style={{ zIndex: lo >= hi && lo > LAST_STEP / 2 ? 3 : 1 }}
        />
        <input
          type="range" aria-label="Maximum price" min={0} max={LAST_STEP} step={1} value={hi}
          onChange={(e) => onChange(min, maxValueAt(Math.max(Number(e.target.value), lo)))}
          className={RANGE}
          style={{ zIndex: 2 }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PriceBox label="Minimum price" placeholder="No min" value={min} onChange={(v) => onChange(v, max)} />
        <span className="text-white/30">–</span>
        <PriceBox label="Maximum price" placeholder="No max" value={max} onChange={(v) => onChange(min, v)} />
      </div>
    </div>
  );
}

function PriceBox({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-[#0f0f0f] px-2 py-1.5 text-sm text-white focus-within:border-[#9E8C61]/60 max-lg:py-2 max-lg:text-base">
      <span className="sr-only">{label}</span>
      <span className="text-white/40">$</span>
      <input
        inputMode="numeric"
        value={formatWithCommas(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(digitsOnly(e.target.value, 9))}
        className="w-full min-w-0 bg-transparent pl-1 outline-none placeholder-white/30"
      />
    </label>
  );
}
```

- [ ] **Step 2: Wire into `FilterBar.tsx`** — `import { PriceRangeFilter } from "./PriceRangeFilter";`; delete `PRICE_PRESETS` and `priceLabel`; the price pill text becomes plain `Price ▾` (still gold via `priceActive`); the price panel becomes:

```tsx
        {openDropdown === "price" && (
          <FilterPanel width="w-72" onApply={apply}>
            <PriceRangeFilter
              min={dv("minPrice")}
              max={dv("maxPrice")}
              onChange={(minPrice, maxPrice) => pick({ minPrice, maxPrice })}
            />
          </FilterPanel>
        )}
```

- [ ] **Step 3: Checks** — full suite, tsc, `next build` (green). Then on a production build (port 3101), in a phone-size and a desktop browser via Puppeteer: open Price, drag each handle (dispatch `input` events at step values), type "812500" in Min, Apply → URL has `minPrice=812500`; drag Min past Max → handles stop at each other; type Min 900000 / Max 500000 → Apply → URL `minPrice=500000&maxPrice=900000`.

- [ ] **Step 4: Commit** — `git add apps/web/src/components/properties/PriceRangeFilter.tsx apps/web/src/components/properties/FilterBar.tsx && git commit -m "feat(filters): Price dropdown — two-handle slider (\$25K steps to \$1M) + Min/Max boxes"`

---

### Task 10: Release-2 verification (filters)

**Files:**
- Create: `.superpowers/pf-survey/filtersPF.cjs` (git-ignored)

- [ ] **Step 1:** Old build = worktree at the Task 6 commit point (`4e5b21b` is fine — closed-state pages must match it); new = HEAD. Start 3100/3101.
- [ ] **Step 2: Desktop closed state unchanged** — `node abPF.cjs 3100 3101 s2` plus a pixel compare of `/properties?query=pasadena` filter row (dropdowns closed) at 1440/1280/1024. Expected: identical.
- [ ] **Step 3: Open dropdowns (approved change)** — `filtersPF.cjs` screenshots each of the five dropdowns open at 1440×900 and 390×844, 320×568, 844×390. Check: Apply visible and inside the screen, no sideways scroll, phone sheet scrolls if taller than 75% of the screen, Price slider usable by touch (`hasTouch`, drag via touchscreen).
- [ ] **Step 4: Apply semantics** — per dropdown: pick an option, click outside → URL unchanged and results count unchanged; pick again, Escape → unchanged; pick, Apply → URL updated, results change, pill turns gold.
- [ ] **Step 5: Speed** — `SPD_PAGES="/properties?query=pasadena" node speedPF.cjs` old vs new, desktop and phone. Expected: equal script count ±1, load within noise.
- [ ] **Step 6:** Stop servers, kill leftover port children, remove worktree. Send Ryan the screenshots of the open dropdowns for a look before any push.

---

### Task 11: Release (Ryan's go-ahead required)

- [ ] **Step 1:** Final whole-branch review (fresh reviewer, most capable model) over `f74a844..HEAD`, with this plan's Review Focus. Fix Critical/Important findings test-first; list minors for Ryan.
- [ ] **Step 2:** Ask Ryan to push. On "yes": `git push origin main` (includes the How to Join fix `4e5b21b`); watch `https://api.github.com/repos/ryanczoo/CnC-Realty/commits/<sha>/status` until "Deployment has completed".
- [ ] **Step 3: Post-deploy backfill re-run** — `cd packages/database && node backfill-property-area.mjs` (fills `area` on listings the old production sync created after Task 1). Expected: a small "filled" count.
- [ ] **Step 4: Live check** — cache-busted `/api/properties` on cncrealtygroup.com for "Silver Lake", "Orange County", "condos in Pasadena under 800k" params, "328 Lincoln Ave"; homepage and `/home-value` return 200.
- [ ] **Step 5:** Update memory (project file) with commits, pushed/live state, and tooling scripts.
