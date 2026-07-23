# Buy Page "Start Your Search" Listings Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Start Your Search" section to the Buy page combining the homepage hero's search bar with the Exclusive Listings auto-scrolling marquee, stacked (search on top, listings below, "View All" CTA at the bottom).

**Architecture:** Extract two currently-inline pieces of the homepage's `FeaturedListings`/`HeroSection` components into shared, independently testable units — the listings query (`lib/listings.ts`) and the search-submit URL-building logic (`lib/property-search.ts`) — plus a shared `ListingsMarquee` presentational component. Build the new Buy-page section from those shared pieces rather than duplicating them, then wire it into `buy/page.tsx`.

**Tech Stack:** Next.js 14 App Router, React Server/Client Components, Prisma, Tailwind, `motion/react`, Vitest.

## Global Constraints

- No behavior change to the homepage's existing "Exclusive Listings" section — Tasks 1–3 are pure refactors (extraction only), verified by confirming the homepage still renders and behaves identically.
- No changes to `/properties`, `FilterBar.tsx`, `PropertyMapInner.tsx`, or `SearchResults.tsx` — out of scope per the spec.
- `PlaceholdersAndVanishInput` is reused with zero prop or style changes — confirmed in the spec it needs no recoloring.
- New section background: `#F2F0EF`, matching the color the page already expects immediately after `BuyContemporary` (see spec §"Page placement").
- Title: "Start Your Search" — two-line `RevealLine` treatment matching `BuyFeatures`' "One stop **SHOP**" pattern; "Search" gets `text-cnc-gold font-medium`, indented under "Your".
- This codebase's test setup (`apps/web/vitest.config.ts`) only runs `src/**/*.test.ts` under `environment: "node"` — there is no React component-rendering test harness (no `@testing-library/react`, no jsdom). Pure-logic extractions (Tasks 1–2) get real Vitest unit tests; JSX-only work (Tasks 3–5) is verified by running the dev server and visually confirming in-browser, per this project's established pattern (`superpowers:verify` / the `run` skill).
- Run `pnpm --filter web test` for the test suite, `pnpm --filter web exec tsc --noEmit` for type-checking, `pnpm --filter web dev` to run the app.

---

## File Structure

**New files:**
- `apps/web/src/lib/property-search.ts` — pure `buildPropertySearchParams(raw: string): URLSearchParams` helper, extracted from `HeroSection.tsx`'s inline submit handler.
- `apps/web/src/lib/property-search.test.ts` — unit tests for the above.
- `apps/web/src/lib/listings.ts` — `FeaturedListing` type, `PLACEHOLDER_LISTINGS` fallback data, and `getFeaturedListings()` query, extracted from `FeaturedListings.tsx` / `FeaturedListingsServer.tsx`.
- `apps/web/src/lib/listings.test.ts` — unit tests for `getFeaturedListings()` (mocked Prisma).
- `apps/web/src/components/home/ListingsMarquee.tsx` — the auto-scrolling card row + fade edges, extracted from `FeaturedListings.tsx`.
- `apps/web/src/components/buy/BuySearchListings.tsx` — new client component: title + search bar + `ListingsMarquee` + "View All" CTA.
- `apps/web/src/components/buy/BuySearchListingsServer.tsx` — new server component: fetches via `getFeaturedListings()`, renders `BuySearchListings`.

**Modified files:**
- `apps/web/src/components/home/HeroSection.tsx` — submit handler calls `buildPropertySearchParams` instead of inlining the regex logic.
- `apps/web/src/components/home/FeaturedListings.tsx` — marquee body replaced with `<ListingsMarquee />`; `FeaturedListing` type and `PLACEHOLDER_LISTINGS` now imported from `lib/listings.ts` instead of declared locally.
- `apps/web/src/components/home/FeaturedListingsServer.tsx` — query body replaced with a call to `getFeaturedListings()`.
- `apps/web/src/app/(marketing)/buy/page.tsx` — insert `<BuySearchListingsServer />` between `<BuyContemporary />` and the existing `<GradientBridge from="#F2F0EF" to="#DAD4D2" />`.

---

### Task 1: Extract the search-submit URL logic into a shared, tested helper

**Files:**
- Create: `apps/web/src/lib/property-search.ts`
- Test: `apps/web/src/lib/property-search.test.ts`
- Modify: `apps/web/src/components/home/HeroSection.tsx:107-133`

**Interfaces:**
- Produces: `buildPropertySearchParams(raw: string): URLSearchParams` — later used by Task 5 (`BuySearchListings.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/property-search.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPropertySearchParams } from "./property-search";

describe("buildPropertySearchParams", () => {
  it("extracts bed count from 'N bed' phrasing", () => {
    const params = buildPropertySearchParams("3 bed homes in Pasadena");
    expect(params.get("minBeds")).toBe("3");
  });

  it("extracts bed count from 'N-bed' phrasing", () => {
    const params = buildPropertySearchParams("4-bed house");
    expect(params.get("minBeds")).toBe("4");
  });

  it("extracts city from a trailing 'in {city}' clause", () => {
    const params = buildPropertySearchParams("3 bed homes in Pasadena");
    expect(params.get("query")).toBe("Pasadena");
  });

  it("falls back to the raw query when there's no 'in {city}' clause", () => {
    const params = buildPropertySearchParams("90210");
    expect(params.get("query")).toBe("90210");
    expect(params.get("minBeds")).toBeNull();
  });

  it("falls back to the raw query for a plain city name with no bed count", () => {
    const params = buildPropertySearchParams("Los Angeles, CA");
    expect(params.get("query")).toBe("Los Angeles, CA");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- property-search`
Expected: FAIL — `Cannot find module './property-search'`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/property-search.ts`:

```ts
export function buildPropertySearchParams(raw: string): URLSearchParams {
  const params = new URLSearchParams();

  // Extract "N bed(s)" or "N-bed" → minBeds filter
  const bedMatch = raw.match(/(\d+)\s*-?\s*bed/i);
  if (bedMatch) params.set("minBeds", bedMatch[1]);

  // Extract "in City Name" at end of query → city search
  const cityMatch = raw.match(/\bin\s+([a-zA-Z][a-zA-Z\s]+)$/i);
  if (cityMatch) {
    params.set("query", cityMatch[1].trim());
  } else {
    params.set("query", raw);
  }

  return params;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- property-search`
Expected: PASS (5/5)

- [ ] **Step 5: Update `HeroSection.tsx` to use the shared helper**

In `apps/web/src/components/home/HeroSection.tsx`, replace the `onSubmit` body (lines 110–131 in the current file) so the whole prop reads:

```tsx
          <PlaceholdersAndVanishInput
            placeholders={SEARCH_PLACEHOLDERS}
            onChange={noop}
            onSubmit={(e) => {
              const input = (e.currentTarget as HTMLFormElement).querySelector(
                "input"
              ) as HTMLInputElement;
              const raw = input?.value?.trim();
              if (!raw) return;

              const params = buildPropertySearchParams(raw);
              router.push(`/properties?${params.toString()}`);
            }}
          />
```

Add the import near the top of the file, alongside the existing imports:

```tsx
import { buildPropertySearchParams } from "@/lib/property-search";
```

- [ ] **Step 6: Verify no behavior change**

Run: `pnpm --filter web test`
Expected: full suite passes, same count as before Task 1 plus the 5 new tests.

Then start the dev server (`pnpm --filter web dev`), open `localhost:3000`, type `3 bed homes in Pasadena` into the hero search bar, submit, and confirm it still routes to `/properties?minBeds=3&query=Pasadena` exactly as it did before this change.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/property-search.ts apps/web/src/lib/property-search.test.ts apps/web/src/components/home/HeroSection.tsx
git commit -m "refactor: extract property-search URL builder into a shared, tested helper"
```

---

### Task 2: Extract the listings query into a shared, tested helper

**Files:**
- Create: `apps/web/src/lib/listings.ts`
- Test: `apps/web/src/lib/listings.test.ts`
- Modify: `apps/web/src/components/home/FeaturedListingsServer.tsx` (full file, 42 lines)
- Modify: `apps/web/src/components/home/FeaturedListings.tsx:1-45` (imports + type/const declarations only — marquee JSX untouched in this task)

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma` (existing singleton, already used the same way in `FeaturedListingsServer.tsx` today).
- Produces: `FeaturedListing` type, `PLACEHOLDER_LISTINGS: FeaturedListing[]`, `getFeaturedListings(): Promise<FeaturedListing[]>` — used by Task 3 (`FeaturedListings.tsx`) and Tasks 4–5 (`BuySearchListings.tsx`, `BuySearchListingsServer.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/listings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getFeaturedListings } from "./listings";

describe("getFeaturedListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the top 8 Active/Coming Soon listings ordered by newest first", async () => {
    (prisma.property.findMany as any).mockResolvedValue([]);

    await getFeaturedListings();

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: { status: { in: ["Active", "Coming Soon"] } },
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

  it("maps photos to an array, defaulting to an empty array when not an array", async () => {
    (prisma.property.findMany as any).mockResolvedValue([
      {
        mlsNumber: "123",
        listPrice: 500000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        address: "1 Main St",
        city: "LA",
        status: "Active",
        photos: null,
      },
    ]);

    const result = await getFeaturedListings();

    expect(result[0].photos).toEqual([]);
    expect(result[0].address).toBe("1 Main St");
  });

  it("returns an empty array on query failure instead of throwing", async () => {
    (prisma.property.findMany as any).mockRejectedValue(new Error("db unreachable"));

    const result = await getFeaturedListings();

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- lib/listings`
Expected: FAIL — `Cannot find module './listings'`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/listings.ts`:

```ts
import { prisma } from "@/lib/prisma";

export interface FeaturedListing {
  mlsNumber?: string;
  listPrice?: number;
  price?: string;
  beds: number | null;
  baths: number | null;
  sqft: number | string | null;
  address: string;
  city: string;
  status: string;
  photos?: string[];
  image?: string;
}

export const PLACEHOLDER_LISTINGS: FeaturedListing[] = [
  { price: "$1,250,000", beds: 4, baths: 3, sqft: "2,450", address: "1847 Oak Glen Dr", city: "Pasadena, CA", status: "For Sale", image: "https://picsum.photos/seed/house1/600/400" },
  { price: "$875,000", beds: 3, baths: 2, sqft: "1,820", address: "534 Magnolia Ave", city: "Glendale, CA", status: "For Sale", image: "https://picsum.photos/seed/house2/600/400" },
  { price: "$2,100,000", beds: 5, baths: 4, sqft: "4,100", address: "291 Wistaria Ave", city: "Arcadia, CA", status: "Open House", image: "https://picsum.photos/seed/house3/600/400" },
  { price: "$649,000", beds: 2, baths: 2, sqft: "1,210", address: "88 Olive St #4B", city: "Burbank, CA", status: "For Sale", image: "https://picsum.photos/seed/house4/600/400" },
  { price: "$1,050,000", beds: 3, baths: 3, sqft: "2,180", address: "702 Huntington Dr", city: "San Marino, CA", status: "For Sale", image: "https://picsum.photos/seed/house5/600/400" },
  { price: "$895,000", beds: 4, baths: 2, sqft: "1,960", address: "1103 Foothill Blvd", city: "Monrovia, CA", status: "Open House", image: "https://picsum.photos/seed/house6/600/400" },
  { price: "$1,495,000", beds: 4, baths: 3, sqft: "3,020", address: "445 Sierra Madre Blvd", city: "Sierra Madre, CA", status: "For Sale", image: "https://picsum.photos/seed/house7/600/400" },
  { price: "$735,000", beds: 3, baths: 2, sqft: "1,540", address: "2210 Rosemead Blvd", city: "Temple City, CA", status: "For Sale", image: "https://picsum.photos/seed/house8/600/400" },
];

export async function getFeaturedListings(): Promise<FeaturedListing[]> {
  try {
    const raw = await prisma.property.findMany({
      where: { status: { in: ["Active", "Coming Soon"] } },
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- lib/listings`
Expected: PASS (3/3)

- [ ] **Step 5: Update `FeaturedListingsServer.tsx` to use the shared helper**

Replace the full contents of `apps/web/src/components/home/FeaturedListingsServer.tsx` with:

```tsx
import { getFeaturedListings } from "@/lib/listings";
import { FeaturedListings } from "./FeaturedListings";

export async function FeaturedListingsServer() {
  const listings = await getFeaturedListings();
  return <FeaturedListings listings={listings} />;
}
```

- [ ] **Step 6: Update `FeaturedListings.tsx` to import the shared type and placeholder data**

In `apps/web/src/components/home/FeaturedListings.tsx`, remove the local `interface FeaturedListing { ... }` declaration (lines 12–24) and the local `const PLACEHOLDER_LISTINGS: FeaturedListing[] = [...]` declaration (lines 26–35). Add this import alongside the existing imports at the top of the file:

```tsx
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";
```

The rest of the file (the `Props` interface, the `FeaturedListings` component, the marquee JSX) is untouched in this task — it still references `FeaturedListing` and `PLACEHOLDER_LISTINGS` by the same names, just imported instead of declared locally.

- [ ] **Step 7: Verify no behavior change**

Run: `pnpm --filter web test`
Expected: full suite passes, same count as after Task 1 plus the 3 new tests.

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors introduced by the type/import changes (this repo has pre-existing test-file-only `tsc` errors unrelated to this work — confirm any errors you see pre-date this task by checking they're in files this task didn't touch).

Start the dev server, open `localhost:3000`, scroll to "Exclusive Listings", and confirm the marquee still renders live listings (or placeholders, if run off the office network per the known Neon-port-block issue) exactly as before.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/listings.ts apps/web/src/lib/listings.test.ts apps/web/src/components/home/FeaturedListingsServer.tsx apps/web/src/components/home/FeaturedListings.tsx
git commit -m "refactor: extract featured-listings query into a shared, tested helper"
```

---

### Task 3: Extract the auto-scrolling marquee into a shared component

**Files:**
- Create: `apps/web/src/components/home/ListingsMarquee.tsx`
- Modify: `apps/web/src/components/home/FeaturedListings.tsx` (remaining marquee JSX, plus imports)

**Interfaces:**
- Consumes: `FeaturedListing` type from `@/lib/listings` (Task 2).
- Produces: `ListingsMarquee({ listings: FeaturedListing[] })` — a self-contained marquee (owns its own hover-pause state) — used by Task 5 (`BuySearchListings.tsx`).

Note: the original card-rendering code in `FeaturedListings.tsx` computes a `sqftDisplay` value (lines 89–92 of the pre-Task-1 file) that is never actually rendered anywhere in the card JSX — it's dead code. This extraction drops it; it has zero effect on rendered output, since it was unused before too.

- [ ] **Step 1: Create `ListingsMarquee.tsx`**

Create `apps/web/src/components/home/ListingsMarquee.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { FeaturedListing } from "@/lib/listings";

const STAGGER_OFFSETS = [0, 48, 24];
function cardOffset(i: number, total: number) {
  return STAGGER_OFFSETS[(i % total) % STAGGER_OFFSETS.length];
}

interface Props {
  listings: FeaturedListing[];
}

export function ListingsMarquee({ listings }: Props) {
  const [paused, setPaused] = useState(false);
  const doubled = [...listings, ...listings];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-[#F2F0EF] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-[#F2F0EF] to-transparent" />

      <div
        className="flex items-start gap-5 px-5 pb-16 pt-2"
        style={{
          animation: "testimonial-scroll 80s linear infinite",
          animationPlayState: paused ? "paused" : "running",
          width: "max-content",
        }}
      >
        {doubled.map((listing, i) => {
          const displayPrice = listing.listPrice
            ? `$${listing.listPrice.toLocaleString()}`
            : listing.price ?? "";
          const thumb = listing.photos?.[0] ?? listing.image ?? null;
          const href = listing.mlsNumber
            ? `/properties/${listing.mlsNumber}`
            : "/properties";

          return (
            <Link
              key={`${i}-${listing.address}`}
              href={href}
              className="group relative w-72 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:border-[#c9a84c]/60 hover:shadow-md"
              style={{
                height: "290px",
                transform: `translateY(${cardOffset(i, listings.length)}px)`,
              }}
            >
              <div className="relative h-full w-full">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={listing.address}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="288px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
                    No photo
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span
                  className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold"
                  style={
                    listing.status === "Open House"
                      ? { background: "#9E8C61", color: "#fff" }
                      : {
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }
                  }
                >
                  {listing.status}
                </span>
                <div className="absolute bottom-0 left-0 p-4">
                  <p className="text-base font-bold text-white">{displayPrice}</p>
                  <p className="text-xs font-medium text-white/90">{listing.address}</p>
                  <p className="text-xs text-white/65">{listing.city}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `FeaturedListings.tsx` to use `ListingsMarquee`**

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
}

export function FeaturedListings({ listings: propListings }: Props) {
  const source =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;

  return (
    <section data-navbar-theme="light" className="overflow-hidden bg-[#F2F0EF] py-10">
      <div className="mb-12 pr-[8%] text-right">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealLine>
            <span className="text-[1.9rem] xl:text-[2.2rem]">Exclusive </span>
            <span className="text-cnc-gold font-medium">Listings</span>
          </RevealLine>
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

- [ ] **Step 3: Verify no behavior change**

Run: `pnpm --filter web test`
Expected: full suite still passes, same count as after Task 2 (this task adds no new tests — it's a pure JSX extraction with no new logic, consistent with this repo's convention of not unit-testing component rendering).

Start the dev server, open `localhost:3000`, scroll to "Exclusive Listings", and visually confirm: cards still auto-scroll, pause on hover, show the same stagger offsets, same fade edges, same status badges, same price/address/city overlay text. Compare against a screenshot from before this task if in doubt.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/home/ListingsMarquee.tsx apps/web/src/components/home/FeaturedListings.tsx
git commit -m "refactor: extract listings marquee into a shared ListingsMarquee component"
```

---

### Task 4: Build the new `BuySearchListings` section

**Files:**
- Create: `apps/web/src/components/buy/BuySearchListings.tsx`
- Create: `apps/web/src/components/buy/BuySearchListingsServer.tsx`

**Interfaces:**
- Consumes: `ListingsMarquee` (Task 3), `PlaceholdersAndVanishInput` (existing, unchanged), `buildPropertySearchParams` (Task 1), `getFeaturedListings` / `PLACEHOLDER_LISTINGS` / `FeaturedListing` (Task 2), `RevealLine` (existing, unchanged).
- Produces: `BuySearchListingsServer` — used by Task 5 (`buy/page.tsx`).

- [ ] **Step 1: Create the client component**

Create `apps/web/src/components/buy/BuySearchListings.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RevealLine } from "@/components/ui/reveal-text";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { ListingsMarquee } from "@/components/home/ListingsMarquee";
import { buildPropertySearchParams } from "@/lib/property-search";
import { SPRING_HOVER } from "@/lib/motion";
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";

const MotionLink = motion(Link);

const SEARCH_PLACEHOLDERS = [
  'Search by city, zip, or address…',
  'Try "Los Angeles, CA"',
  'Try "90210"',
  'Try "3 bed homes in Pasadena"',
];

const noop = () => {};

interface Props {
  listings?: FeaturedListing[];
}

export function BuySearchListings({ listings: propListings }: Props) {
  const router = useRouter();
  const listings =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;

  return (
    <section data-navbar-theme="light" className="overflow-hidden bg-[#F2F0EF] py-20">
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

      <div className="mx-auto mb-14 w-full max-w-xl px-4">
        <PlaceholdersAndVanishInput
          placeholders={SEARCH_PLACEHOLDERS}
          onChange={noop}
          onSubmit={(e) => {
            const input = (e.currentTarget as HTMLFormElement).querySelector(
              "input"
            ) as HTMLInputElement;
            const raw = input?.value?.trim();
            if (!raw) return;

            const params = buildPropertySearchParams(raw);
            router.push(`/properties?${params.toString()}`);
          }}
        />
      </div>

      <ListingsMarquee listings={listings} />

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

- [ ] **Step 2: Create the server wrapper**

Create `apps/web/src/components/buy/BuySearchListingsServer.tsx`:

```tsx
import { getFeaturedListings } from "@/lib/listings";
import { BuySearchListings } from "./BuySearchListings";

export async function BuySearchListingsServer() {
  const listings = await getFeaturedListings();
  return <BuySearchListings listings={listings} />;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors. (This section isn't wired into any page yet, so there's nothing to visually check until Task 5 — that's deliberate, keeps this task's diff reviewable on its own.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/buy/BuySearchListings.tsx apps/web/src/components/buy/BuySearchListingsServer.tsx
git commit -m "feat: add BuySearchListings section (not yet wired into the Buy page)"
```

---

### Task 5: Wire the new section into the Buy page

**Files:**
- Modify: `apps/web/src/app/(marketing)/buy/page.tsx:1-64`

**Interfaces:**
- Consumes: `BuySearchListingsServer` (Task 4).

- [ ] **Step 1: Add the import and insert the section**

In `apps/web/src/app/(marketing)/buy/page.tsx`, add this import alongside the existing ones:

```tsx
import { BuySearchListingsServer } from "@/components/buy/BuySearchListingsServer";
```

Then change:

```tsx
      <BuyContemporary />

      <GradientBridge from="#F2F0EF" to="#DAD4D2" />
```

to:

```tsx
      <BuyContemporary />

      <BuySearchListingsServer />

      <GradientBridge from="#F2F0EF" to="#DAD4D2" />
```

- [ ] **Step 2: Verify in the browser**

Run: `pnpm --filter web dev`, open `localhost:3000/buy`.

Confirm, in order:
1. `BuyContemporary`'s dark section ends and the new section starts on `#F2F0EF` with no visible color seam.
2. "Start Your" / "Search" title renders with the same staggered reveal animation as "One stop SHOP" elsewhere on the page, "Search" in gold.
3. The search bar is a white pill, cycles through the same placeholder phrases as the homepage hero's, and typing `3 bed homes in Pasadena` + Enter routes to `/properties?minBeds=3&query=Pasadena`.
4. Below the search bar, the listings marquee auto-scrolls and pauses on hover, showing the same live (or placeholder, if off the office network) listings as the homepage's Exclusive Listings section.
5. "View All" button sits below the marquee and links to `/properties`.
6. The existing `GradientBridge from="#F2F0EF" to="#DAD4D2"` → FAQ section below still renders correctly, unaffected.

Also re-check the homepage (`localhost:3000`) end to end — hero search bar and Exclusive Listings marquee should behave exactly as they did before this whole plan.

- [ ] **Step 3: Run the full test suite one more time**

Run: `pnpm --filter web test`
Expected: full suite passes (same count as end of Task 2 — Tasks 3–5 added no new automated tests, per the Global Constraints note on this repo's test scope).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(marketing\)/buy/page.tsx
git commit -m "feat: wire BuySearchListings into the Buy page"
```

---

## Self-Review

**Spec coverage:**
- Title/copy/placement/gold-accent requirements → Task 4 (component) + Task 5 (page position). ✅
- "No recoloring needed for the search bar" → Task 4 reuses `PlaceholdersAndVanishInput` with zero prop/style changes. ✅
- Shared `ListingsMarquee` extraction (spec's "reuse strategy" §1) → Task 3. ✅
- Shared `getFeaturedListings()` extraction (spec's "reuse strategy" §2) → Task 2. ✅
- Page placement between `BuyContemporary` and the existing `GradientBridge`, no new bridge → Task 5. ✅
- "Not touched: `/properties`, `FilterBar`, `PropertyMapInner`, `SearchResults`, hero's cycling headline, `PlaceholdersAndVanishInput` internals" → none of Tasks 1–5 touch any of these. ✅
- Spec's "Open items" (exact final path for `ListingsMarquee.tsx`, test coverage for the submit-handler logic) → resolved: kept in `components/home/` since that's still its primary call site count-wise (2 of 3 usages logically homepage-adjacent) and it's trivial to move later; submit-handler logic got its own extracted+tested unit in Task 1 rather than staying untested. ✅

**Placeholder scan:** no TBD/TODO, no "similar to Task N" shortcuts — every task has full code. ✅

**Type consistency:** `FeaturedListing` declared once (Task 2, `lib/listings.ts`), imported by name in every other task that uses it (Tasks 2 Step 6, 3, 4) — no redeclaration. `ListingsMarquee`'s `Props.listings` and `BuySearchListings`'s `Props.listings` both type against the same `FeaturedListing[]`. `buildPropertySearchParams(raw: string): URLSearchParams` signature is identical between its Task 1 definition and its Task 4 call site. ✅
