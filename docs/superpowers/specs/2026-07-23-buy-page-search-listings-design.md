# Buy Page — "Start Your Search" Listings Section — Design Spec

**Date:** 2026-07-23
**Status:** Approved by Ryan (2026-07-23) — ready for implementation plan

---

## Why this exists

The Buy page (`apps/web/src/app/(marketing)/buy/page.tsx`) has no live inventory and no way to start a search on it today — a visitor has to click through to `/properties` first. Meanwhile the homepage already has two pieces that solve this separately: the hero's animated search bar (`PlaceholdersAndVanishInput`, parses free text into `/properties?query=...`) and the "Exclusive Listings" auto-scrolling marquee of real active listings (`FeaturedListings.tsx`). Ryan wants both combined into one new section on the Buy page, stacked (search on top, marquee below), not overlaid.

---

## What ships

A new section, `BuySearchListings`, inserted into the Buy page between `BuyContemporary` and the existing FAQ `GradientBridge`:

```
<BuyContemporary />
<BuySearchListings />          ← new
<GradientBridge from="#F2F0EF" to="#DAD4D2" />
<FAQ ... />
```

`BuyContemporary` ends dark (`#1B1B1B`) but the page already places a `GradientBridge from="#F2F0EF"` directly after it — i.e. the page already assumes `#F2F0EF` starts right after `BuyContemporary`. `BuySearchListings` uses that same `#F2F0EF` background, so it drops into the existing color flow with no new bridge needed.

### Section content, top to bottom

1. **Title:** "Start Your Search" — two-line staggered title, same `RevealLine` pattern as `BuyFeatures`' "One stop **SHOP**": line 1 "Start Your", line 2 "**Search**" indented to sit under "Your" (not under "Start"), gold accent + medium weight (`text-cnc-gold font-medium`) on "Search", matching how "SHOP" is styled today.
2. **Search bar:** `PlaceholdersAndVanishInput`, reused unchanged — same `SEARCH_PLACEHOLDERS` copy, same submit handler (bed-count regex, "in {city}" regex, fallback to raw query) routing to `/properties?...`. The component is already a white pill with black text and a neutral-gray placeholder (confirmed by reading `placeholders-and-vanish-input.tsx`) — it was never dark-themed itself, it just sits on a dark video in the hero. No recoloring needed for `#F2F0EF`.
3. **Listings marquee:** same auto-scrolling row of listing cards as "Exclusive Listings" — pauses on hover, same card styling (photo, status badge, price/address/city overlay), same fade edges on either side.
4. **"View All" CTA:** same position, style, and `/properties` link as the current Exclusive Listings section.

---

## Component architecture

### 1. Extract the marquee into a shared component

`FeaturedListings.tsx` currently owns ~100 lines of marquee logic (auto-scroll animation, hover-pause state, fade-edge overlays, per-card rendering, the `PLACEHOLDER_LISTINGS` fallback data) inline. Rather than duplicate that into the new Buy-page component, extract it into:

`apps/web/src/components/home/ListingsMarquee.tsx` (or a shared `components/listings/` location if that reads better at implementation time)
- Props: `listings: FeaturedListing[]` (same shape as today), renders the scroll row + fade edges + cards
- `FeaturedListings.tsx` becomes: title + `ListingsMarquee` + "View All" CTA (its current title/CTA stay put — only the marquee body moves)
- `BuySearchListings.tsx` becomes: new "Start Your Search" title + `PlaceholdersAndVanishInput` + `ListingsMarquee` + "View All" CTA

This mirrors the precedent already set in this codebase (shared `FormField` extracted from the New Transaction/New Listing wizards) — one component, two call sites, not two copies to keep in sync.

### 2. Extract the data query into a shared helper

`FeaturedListingsServer.tsx` currently owns the Prisma query (top 8 `Active`/`Coming Soon` listings, `orderBy: listedAt desc`, `take: 8`) inline. Extract it into a shared helper, e.g. `apps/web/src/lib/listings.ts` → `getFeaturedListings()`, returning the same mapped shape. Both `FeaturedListingsServer` and a new `BuySearchListingsServer` call it. Same try/catch-and-fall-back-to-placeholder-data behavior as today on query failure.

`buy/page.tsx` is a server component already (no `"use client"`), so `BuySearchListingsServer` slots in the same way `FeaturedListingsServer` does on the homepage — an `async` server component wrapping the client `BuySearchListings`.

### 3. New files

- `apps/web/src/components/buy/BuySearchListings.tsx` — client component (title + search bar + marquee + CTA)
- `apps/web/src/components/buy/BuySearchListingsServer.tsx` — server component (fetches via `getFeaturedListings()`, passes to `BuySearchListings`)
- `apps/web/src/components/home/ListingsMarquee.tsx` — extracted shared marquee (used by both `FeaturedListings` and `BuySearchListings`)
- `apps/web/src/lib/listings.ts` — extracted shared `getFeaturedListings()` query

### Modified files

- `apps/web/src/components/home/FeaturedListings.tsx` — marquee body replaced with `<ListingsMarquee listings={...} />`; title/CTA unchanged
- `apps/web/src/components/home/FeaturedListingsServer.tsx` — query body replaced with a call to `getFeaturedListings()`
- `apps/web/src/app/(marketing)/buy/page.tsx` — insert `<BuySearchListingsServer />` between `<BuyContemporary />` and the existing `<GradientBridge from="#F2F0EF" to="#DAD4D2" />`

---

## What is explicitly NOT touched

- `/properties`, `FilterBar.tsx`, `PropertyMapInner.tsx`, `SearchResults.tsx` — this feature only links to `/properties`, it doesn't change anything on that page.
- The homepage hero (`HeroSection.tsx`) — its cycling animated headline phrases stay hero-only; the Buy page section uses a static title instead (Ryan's explicit call, no cycling headline on Buy page).
- `PlaceholdersAndVanishInput` itself — reused with zero prop/style changes.

---

## Performance, discussed with Ryan

- Buy page currently makes zero DB queries; this adds one — the same small, indexed `take: 8` query the homepage already runs. Not expected to be perceptible, but it is a new query where there was none before.
- No change to `/properties` or its map page — nothing in this feature touches that route.
- Neon cold-start latency (an existing, site-wide characteristic on every DB-backed page, not introduced by this work) is the only realistic source of a perceptible one-time delay, and it's no more likely here than on any other DB-backed page today.

---

## Open items for the implementation plan

- Exact final path for `ListingsMarquee.tsx` (`components/home/` vs. a new shared `components/listings/` directory) — either works, pick whichever reads more naturally once both call sites exist.
- Test coverage: submit-handler parsing (bed count / city extraction) is already covered wherever the hero's equivalent logic is tested today, if it is — confirm during planning whether that logic needs its own extracted/shared test, since it's the exact same submit handler reused verbatim.
