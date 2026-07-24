# City-Personalized Listings Marquee — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter both the homepage's and Buy page's listings marquees to the visitor's detected city (via Vercel's edge geo header), falling back to Los Angeles when undetected or sparse. Homepage title becomes a dynamic "{count}+ Listings in {city}"; Buy page title becomes a static "Search Here".

**Architecture:** A new pure-logic-plus-mockable-Prisma helper (`lib/visitor-city.ts`) resolves the visitor's city and its listing count. `getFeaturedListings()` gains a required `city` parameter. Both existing server-component call sites (`FeaturedListingsServer.tsx`, `BuySearchListingsServer.tsx`) read the Vercel geo header, resolve the city, and pass it through. Title JSX changes are presentation-only.

**Tech Stack:** Next.js 14.2 App Router (`next/headers`), React Server/Client Components, Prisma, Tailwind, `motion/react`, Vitest.

## Global Constraints

- `Property.city` stores plain Title Case city names with no state suffix (confirmed via live query against real data — e.g. `"Antioch"`, `"Palm Desert"`, not `"Antioch, CA"`). All city matching (both the count check and the listings query) must use `{ equals: <city>, mode: "insensitive" }` — confirmed case-insensitive matching returns identical results to exact-case matching against real data (12,924 rows either way for `"Los Angeles"`).
- Fallback city: **`"Los Angeles"`**. Fallback threshold: candidate city must have **at least 4** matching listings (`status IN (Active, ComingSoon, ActiveUnderContract)`), else use the fallback. One rule covers both "no city detected" and "city detected but sparse" — there is no separate code path for the two cases.
- Vercel's `x-vercel-ip-city` header is URL-encoded and only present on actual Vercel deployments (production/preview) — **absent when running `next dev` locally**. Local dev will always exercise the fallback-to-Los-Angeles path; this is expected, not a bug.
- `next/headers`'s `headers()` is synchronous in Next.js 14.2 (no `await`) — do not add one.
- Homepage title line 2 (city) and Buy-page title's "Here" both use the site's existing gold-accent convention: `text-cnc-gold font-medium`.
- No new database index — `Property` already has `@@index([city])`, `@@index([status, listingType])`, and GIN trigram indexes; sufficient at current data scale for a `status IN (...) AND city = X` query.
- Run `pnpm --filter web test` for the test suite, `pnpm --filter web exec tsc --noEmit` for type-checking, `pnpm --filter web dev` to run the app (from the repo root — this is a pnpm workspace).

---

## File Structure

**New files:**
- `apps/web/src/lib/visitor-city.ts` — `parseCityHeader(raw: string | null): string | null` (pure) and `resolveVisitorCity(candidateCity: string | null): Promise<{ city: string; count: number }>` (async, Prisma-backed), plus exported `FALLBACK_CITY` / `MIN_LISTINGS` constants.
- `apps/web/src/lib/visitor-city.test.ts` — unit tests for both functions.

**Modified files:**
- `apps/web/src/lib/listings.ts` — `getFeaturedListings()` gains a required `city: string` parameter, adds a case-insensitive `city` filter to the existing `where` clause.
- `apps/web/src/lib/listings.test.ts` — existing tests updated to pass a city argument and assert the new filter.
- `apps/web/src/components/home/FeaturedListingsServer.tsx` — reads the geo header, resolves the city (and count), passes both to `FeaturedListings` along with the city-filtered listings.
- `apps/web/src/components/home/FeaturedListings.tsx` — accepts `city: string; count: number` props; title becomes a two-line dynamic "{count}+ Listings in" / "{city}" (gold).
- `apps/web/src/components/buy/BuySearchListingsServer.tsx` — reads the geo header, resolves the city, passes the city-filtered listings to `BuySearchListings` (no count/city prop needed — Buy page title is static).
- `apps/web/src/components/buy/BuySearchListings.tsx` — title changes from "Start Your Search" (two-line) to "Search Here" (single-line, matching `HomeValueTeaser`'s "Sell Smarter" pattern).

---

### Task 1: `visitor-city.ts` — city resolution helper

**Files:**
- Create: `apps/web/src/lib/visitor-city.ts`
- Test: `apps/web/src/lib/visitor-city.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma` (existing singleton).
- Produces: `parseCityHeader(raw: string | null): string | null`, `resolveVisitorCity(candidateCity: string | null): Promise<{ city: string; count: number }>`, `FALLBACK_CITY: string`, `MIN_LISTINGS: number` — used by Task 2 (`FeaturedListingsServer.tsx`, `BuySearchListingsServer.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/visitor-city.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { parseCityHeader, resolveVisitorCity, FALLBACK_CITY, MIN_LISTINGS } from "./visitor-city";

describe("parseCityHeader", () => {
  it("URL-decodes a city header value", () => {
    expect(parseCityHeader("San%20Francisco")).toBe("San Francisco");
  });

  it("returns null when the header is missing", () => {
    expect(parseCityHeader(null)).toBeNull();
  });

  it("returns null when the decoded value is empty or whitespace-only", () => {
    expect(parseCityHeader("   ")).toBeNull();
  });
});

describe("resolveVisitorCity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the candidate city when it has at least MIN_LISTINGS matching listings", async () => {
    (prisma.property.count as any).mockResolvedValue(10);

    const result = await resolveVisitorCity("Pasadena");

    expect(result).toEqual({ city: "Pasadena", count: 10 });
    expect(prisma.property.count).toHaveBeenCalledWith({
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: "Pasadena", mode: "insensitive" },
      },
    });
  });

  it("uses the candidate city when its count is exactly MIN_LISTINGS", async () => {
    (prisma.property.count as any).mockResolvedValue(MIN_LISTINGS);

    const result = await resolveVisitorCity("Pasadena");

    expect(result).toEqual({ city: "Pasadena", count: MIN_LISTINGS });
  });

  it(`falls back to ${FALLBACK_CITY} when the candidate city has fewer than MIN_LISTINGS matching listings`, async () => {
    (prisma.property.count as any)
      .mockResolvedValueOnce(MIN_LISTINGS - 1)
      .mockResolvedValueOnce(500);

    const result = await resolveVisitorCity("Tiny Town");

    expect(result).toEqual({ city: FALLBACK_CITY, count: 500 });
    expect(prisma.property.count).toHaveBeenNthCalledWith(2, {
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: FALLBACK_CITY, mode: "insensitive" },
      },
    });
  });

  it(`falls back to ${FALLBACK_CITY} when no candidate city was detected`, async () => {
    (prisma.property.count as any).mockResolvedValue(500);

    const result = await resolveVisitorCity(null);

    expect(result).toEqual({ city: FALLBACK_CITY, count: 500 });
    expect(prisma.property.count).toHaveBeenCalledTimes(1);
  });

  it(`returns ${FALLBACK_CITY} with count 0 when the database is unreachable`, async () => {
    (prisma.property.count as any).mockRejectedValue(new Error("db unreachable"));

    const result = await resolveVisitorCity("Pasadena");

    expect(result).toEqual({ city: FALLBACK_CITY, count: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- visitor-city`
Expected: FAIL — `Cannot find module './visitor-city'`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/visitor-city.ts`:

```ts
import { prisma } from "@/lib/prisma";

export const FALLBACK_CITY = "Los Angeles";
export const MIN_LISTINGS = 4;

const MATCHING_STATUSES = ["Active", "ComingSoon", "ActiveUnderContract"];

export function parseCityHeader(raw: string | null): string | null {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw).trim();
  return decoded.length > 0 ? decoded : null;
}

async function countListingsInCity(city: string): Promise<number> {
  return prisma.property.count({
    where: {
      status: { in: MATCHING_STATUSES },
      city: { equals: city, mode: "insensitive" },
    },
  });
}

export async function resolveVisitorCity(
  candidateCity: string | null
): Promise<{ city: string; count: number }> {
  try {
    if (candidateCity) {
      const count = await countListingsInCity(candidateCity);
      if (count >= MIN_LISTINGS) {
        return { city: candidateCity, count };
      }
    }

    const fallbackCount = await countListingsInCity(FALLBACK_CITY);
    return { city: FALLBACK_CITY, count: fallbackCount };
  } catch {
    return { city: FALLBACK_CITY, count: 0 };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- visitor-city`
Expected: PASS (8/8)

- [ ] **Step 5: Verify no regressions**

Run: `pnpm --filter web test`
Expected: full suite passes, previous count (532) plus 8 new tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/visitor-city.ts apps/web/src/lib/visitor-city.test.ts
git commit -m "feat: add visitor-city resolution helper with Los Angeles fallback"
```

---

### Task 2: `getFeaturedListings()` takes a city, both server components wired

This task must land as one atomic change — an intermediate state where `getFeaturedListings()` requires a `city` argument but only one of its two call sites supplies one would fail to compile. Do not split this across commits.

**Files:**
- Modify: `apps/web/src/lib/listings.ts`
- Modify: `apps/web/src/lib/listings.test.ts`
- Modify: `apps/web/src/components/home/FeaturedListingsServer.tsx` (full file, 7 lines)
- Modify: `apps/web/src/components/buy/BuySearchListingsServer.tsx` (full file, 7 lines)

**Interfaces:**
- Consumes: `parseCityHeader`, `resolveVisitorCity` (Task 1); `headers` from `next/headers` (Next.js built-in, synchronous in 14.2).
- Produces: `getFeaturedListings(city: string): Promise<FeaturedListing[]>` — signature change from Task 4/5 of the prior plan's `getFeaturedListings(): Promise<FeaturedListing[]>`. Consumed by Task 3 (unchanged usage, already city-aware after this task) and Task 4 (no further change needed to the call, `BuySearchListingsServer.tsx` is fully updated here).

- [ ] **Step 1: Update the failing tests first**

In `apps/web/src/lib/listings.test.ts`, update all three `getFeaturedListings()` calls to pass a city argument, and update the first test's assertion to include the city filter:

```ts
  it("queries the top 8 Active/ComingSoon/ActiveUnderContract listings in the given city, ordered by newest first", async () => {
    (prisma.property.findMany as any).mockResolvedValue([]);

    await getFeaturedListings("Los Angeles");

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: "Los Angeles", mode: "insensitive" },
      },
      orderBy: { listedAt: "desc" },
      take: 8,
      select: {
        mlsNumber: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        address: true,
        city: true,
        status: true,
        photos: true,
      },
    });
  });
```

In the second test (`"maps photos to an array..."`), change `await getFeaturedListings();` to `await getFeaturedListings("Los Angeles");`.

In the third test (`"returns an empty array on query failure..."`), change `await getFeaturedListings();` to `await getFeaturedListings("Los Angeles");`.

- [ ] **Step 2: Run tests to verify the first one fails**

Run: `pnpm --filter web test -- lib/listings`
Expected: FAIL on the first test (assertion mismatch: actual call has no `city` in `where`) — also a TypeScript error on all three calls (`Expected 1 arguments, but got 0`) since `getFeaturedListings` doesn't accept a parameter yet.

- [ ] **Step 3: Update `getFeaturedListings()`**

In `apps/web/src/lib/listings.ts`, change the function signature and `where` clause:

```ts
export async function getFeaturedListings(city: string): Promise<FeaturedListing[]> {
  try {
    const raw = await prisma.property.findMany({
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: city, mode: "insensitive" },
      },
      orderBy: { listedAt: "desc" },
      take: 8,
      select: {
        mlsNumber: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        address: true,
        city: true,
        status: true,
        photos: true,
      },
    });

    return raw.map((p) => ({
      mlsNumber: p.mlsNumber,
      listPrice: p.listPrice,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      address: p.address,
      city: p.city,
      status: p.status,
      photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
    }));
  } catch {
    return [];
  }
}
```

(Only the function signature's `city: string` parameter and the `where` clause change — everything else in the function is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- lib/listings`
Expected: PASS (3/3)

- [ ] **Step 5: Update `FeaturedListingsServer.tsx`**

Replace the full contents of `apps/web/src/components/home/FeaturedListingsServer.tsx` with:

```tsx
import { headers } from "next/headers";
import { getFeaturedListings } from "@/lib/listings";
import { parseCityHeader, resolveVisitorCity } from "@/lib/visitor-city";
import { FeaturedListings } from "./FeaturedListings";

export async function FeaturedListingsServer() {
  const candidateCity = parseCityHeader(headers().get("x-vercel-ip-city"));
  const { city } = await resolveVisitorCity(candidateCity);
  const listings = await getFeaturedListings(city);
  return <FeaturedListings listings={listings} />;
}
```

(`resolveVisitorCity` also returns `count`, but it isn't used yet — Task 3 changes this line to destructure and pass both `city` and `count` once `FeaturedListings` accepts them. Destructuring only `{ city }` here avoids an unused-variable state in this task's diff.)

- [ ] **Step 6: Update `BuySearchListingsServer.tsx`**

Replace the full contents of `apps/web/src/components/buy/BuySearchListingsServer.tsx` with:

```tsx
import { headers } from "next/headers";
import { getFeaturedListings } from "@/lib/listings";
import { parseCityHeader, resolveVisitorCity } from "@/lib/visitor-city";
import { BuySearchListings } from "./BuySearchListings";

export async function BuySearchListingsServer() {
  const candidateCity = parseCityHeader(headers().get("x-vercel-ip-city"));
  const { city } = await resolveVisitorCity(candidateCity);
  const listings = await getFeaturedListings(city);
  return <BuySearchListings listings={listings} />;
}
```

(This is `BuySearchListingsServer`'s final form for this plan — the Buy page title stays static, so it never needs `count`.)

- [ ] **Step 7: Verify the full suite and types**

Run: `pnpm --filter web test`
Expected: full suite passes.

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors (pre-existing test-file-only errors are expected and fine — confirm any errors you see aren't in files this task touched).

Start the dev server (`pnpm --filter web dev`), open `localhost:3000` and `localhost:3000/buy`. Since Vercel's geo header is absent locally, both pages should now show **Los Angeles** listings in their marquees (the fallback path) rather than the previous sitewide top-8. Confirm via each card's city label reading "Los Angeles" (or via view-source, check the rendered `href="/properties/<mlsNumber>"` links resolve to real LA listings — cross-reference a couple against `/properties?query=Los Angeles` if you want to be thorough).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/listings.ts apps/web/src/lib/listings.test.ts apps/web/src/components/home/FeaturedListingsServer.tsx apps/web/src/components/buy/BuySearchListingsServer.tsx
git commit -m "feat: filter featured listings by visitor's detected city"
```

---

### Task 3: Homepage dynamic title — "{count}+ Listings in {city}"

**Files:**
- Modify: `apps/web/src/components/home/FeaturedListings.tsx` (full file, 45 lines)
- Modify: `apps/web/src/components/home/FeaturedListingsServer.tsx` (the one line from Task 2, Step 5)

**Interfaces:**
- Consumes: `count` from `resolveVisitorCity` (Task 1/2, previously unused).
- Produces: `FeaturedListings` now requires `city: string` and `count: number` props in addition to its existing optional `listings`.

- [ ] **Step 1: Update `FeaturedListingsServer.tsx` to pass city and count**

In `apps/web/src/components/home/FeaturedListingsServer.tsx`, change:

```tsx
  const { city } = await resolveVisitorCity(candidateCity);
  const listings = await getFeaturedListings(city);
  return <FeaturedListings listings={listings} />;
```

to:

```tsx
  const { city, count } = await resolveVisitorCity(candidateCity);
  const listings = await getFeaturedListings(city);
  return <FeaturedListings listings={listings} city={city} count={count} />;
```

- [ ] **Step 2: Update `FeaturedListings.tsx`**

Replace the full contents of `apps/web/src/components/home/FeaturedListings.tsx` with:

```tsx
"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { RevealLine } from "@/components/ui/reveal-text";
import { SPRING_HOVER } from "@/lib/motion";
import { ListingsMarquee } from "./ListingsMarquee";
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";

const MotionLink = motion(Link);

interface Props {
  listings?: FeaturedListing[];
  city: string;
  count: number;
}

export function FeaturedListings({ listings: propListings, city, count }: Props) {
  const source =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;

  return (
    <section data-navbar-theme="light" className="overflow-hidden bg-[#F2F0EF] py-10">
      <div className="mb-12 pr-[8%] text-right">
        <h2 className="font-sans font-light leading-[1.05]">
          <span className="block text-[1.9rem] xl:text-[2.2rem] text-[#1B1B1B]">
            <RevealLine delay={0}>{count}+ Listings in</RevealLine>
          </span>
          <span className="block text-[2.5rem] xl:text-[3rem]">
            <RevealLine delay={0.15}>
              <span className="text-cnc-gold font-medium">{city}</span>
            </RevealLine>
          </span>
        </h2>
      </div>

      <ListingsMarquee listings={source} />

      <div className="mt-10 text-center">
        <MotionLink
          href="/properties"
          whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
          className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
        >
          View All
        </MotionLink>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify types and render**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors.

Start the dev server, open `localhost:3000`. Confirm the section title (previously "Exclusive Listings") now reads as two staggered-reveal lines: a smaller line "{count}+ Listings in" followed by a larger gold line "Los Angeles" (the fallback city, since local dev has no geo header) — mirroring the same two-line staggered animation style as "One stop **SHOP**" elsewhere on the site. Confirm `{count}` is a real number matching roughly the live count of Los Angeles listings (thousands, not the 8 shown in the marquee).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/home/FeaturedListings.tsx apps/web/src/components/home/FeaturedListingsServer.tsx
git commit -m "feat: homepage listings title becomes dynamic count-and-city headline"
```

---

### Task 4: Buy page static title — "Search Here"

**Files:**
- Modify: `apps/web/src/components/buy/BuySearchListings.tsx:35-46` (title block only — search bar, marquee, and CTA below are untouched)

**Interfaces:**
- No prop or interface changes — `BuySearchListings`'s `Props` (`listings?: FeaturedListing[]`) is unchanged. This task is presentation-only.

- [ ] **Step 1: Update the title block**

In `apps/web/src/components/buy/BuySearchListings.tsx`, replace:

```tsx
      <div className="mb-12 flex justify-center">
        <h2 className="text-center font-sans font-light leading-[1.05]">
          <span className="block text-[2.4rem] xl:text-[2.9rem] text-[#1B1B1B]">
            <RevealLine delay={0}>Start Your</RevealLine>
          </span>
          <span className="block text-[3.2rem] xl:text-[3.8rem] ml-[5rem] xl:ml-[6rem]">
            <RevealLine delay={0.15}>
              <span className="text-cnc-gold font-medium">Search</span>
            </RevealLine>
          </span>
        </h2>
      </div>
```

with:

```tsx
      <div className="mb-12 flex justify-center">
        <h2 className="text-center font-sans text-[2.8rem] font-light text-[#1B1B1B] xl:text-[3.4rem]">
          <RevealLine>
            <span className="text-[2.1rem] xl:text-[2.5rem]">Search </span>
            <span className="text-cnc-gold font-medium">Here</span>
          </RevealLine>
        </h2>
      </div>
```

This mirrors `HomeValueTeaser.tsx`'s "Sell **Smarter**" title exactly (same font sizes, same single-`RevealLine`-with-two-inline-spans structure, same gold-accent second word) rather than the two-line staggered pattern this title previously used.

- [ ] **Step 2: Verify types and render**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors.

Start the dev server, open `localhost:3000/buy`. Confirm the title now reads "Search **Here**" on a single line (not two staggered lines), gold on "Here", visually matching the "Sell **Smarter**" title on the Sell page's home-value section. Confirm the search bar, marquee (now showing Los Angeles listings via the fallback path), and "View All" CTA below it are all unaffected.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/buy/BuySearchListings.tsx
git commit -m "feat: Buy page listings title becomes static \"Search Here\""
```

---

### Task 5: Final integration verification

**Files:** none (verification-only task, no code changes)

- [ ] **Step 1: Full suite and type-check**

Run: `pnpm --filter web test`
Expected: full suite passes (previous count + the 8 new `visitor-city.test.ts` tests from Task 1).

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors anywhere in the touched files.

- [ ] **Step 2: End-to-end browser verification**

With the dev server running, check both pages one more time together:

- `localhost:3000` — title reads "{count}+ Listings in **Los Angeles**" (two-line, staggered reveal, gold city), marquee shows real LA listings, "View All" links to `/properties`.
- `localhost:3000/buy` — title reads "Search **Here**" (single line, gold "Here"), search bar behaves as before (placeholder cycling, submits to `/properties?...`), marquee shows real LA listings (same fallback as homepage), "View All" CTA present.
- Confirm neither page's marquee regressed to showing `PLACEHOLDER_LISTINGS` fixture data (e.g. "1847 Oak Glen Dr") — both should show real MLS-numbered listings from the database.

- [ ] **Step 3: Note the real-per-visitor-city caveat**

No code change needed here — just confirm in the final report that true per-visitor-city behavior (anything other than the Los Angeles fallback) can only be verified after deployment to Vercel (production or preview), since `x-vercel-ip-city` is absent in local `next dev`. This mirrors the same caveat already true of the underlying Buy-page-section work from the prior plan.

---

## Self-Review

**Spec coverage:**
- Shared city-detection + single fallback rule (spec §1) → Task 1. ✅
- `getFeaturedListings()` city parameter, both call sites updated atomically (spec §2, "Open items") → Task 2. ✅
- Homepage dynamic title, exact copy rules ("Listings" not "Homes", no ", CA", gold city, two-line staggered pattern, "{count}+" always with trailing plus) → Task 3. ✅
- Buy page static "Search Here" title matching `HomeValueTeaser`'s exact pattern, Buy marquee city-filtered without displaying city in title → Task 2 (filtering) + Task 4 (title). ✅
- No new index, no client geolocation, `/properties`/`FilterBar`/`PropertyMapInner`/`SearchResults` untouched → confirmed, no task touches any of these. ✅

**Placeholder scan:** no TBD/TODO, no "similar to Task N" shortcuts — every task has complete code. ✅

**Type consistency:** `parseCityHeader(raw: string | null): string | null` and `resolveVisitorCity(candidateCity: string | null): Promise<{ city: string; count: number }>` are defined once (Task 1) and called identically in both Task 2 call sites. `getFeaturedListings(city: string)` signature is consistent between its Task 2 definition and both consumers. `FeaturedListings`'s `Props` (`listings?`, `city`, `count`) match exactly between its Task 3 definition and `FeaturedListingsServer.tsx`'s JSX call. ✅
