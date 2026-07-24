# City-Personalized Listings Marquee — Design Spec

**Date:** 2026-07-23
**Status:** Approved by Ryan (2026-07-23) — ready for implementation plan
**Builds on:** `docs/superpowers/specs/2026-07-23-buy-page-search-listings-design.md` (the shared `getFeaturedListings()`/`ListingsMarquee` infrastructure this spec extends) and its bug-fix follow-up (`64a624e`, corrected RESO status filter — already shipped, not part of this spec).

---

## Why this exists

Inspired by eXp Realty's homepage (`exprealty.com`), which titles its listings section "54+ Properties in — {City}, CA" using the visitor's detected location. Ryan wants the same personalization: both the homepage's listings marquee and the new Buy-page listings marquee (from the prior spec) should show listings from the visitor's own city instead of an undifferentiated sitewide top-8, and the homepage's title should reflect the detected city dynamically.

---

## What ships

### 1. Shared city-detection + fallback logic

New helper, e.g. `apps/web/src/lib/visitor-city.ts`:

- Reads Vercel's edge geo header `x-vercel-ip-city` (set automatically on every request on Vercel deployments — production and preview; **absent when running `next dev` locally**, so local testing always exercises the fallback path).
- URL-decodes the header value (Vercel sends it URI-encoded, e.g. `San%20Francisco`).
- Matches against `Property.city` **case-insensitively** — confirmed via a live query against the real database that `Property.city` stores plain Title Case city names with no state suffix (e.g. `"Antioch"`, `"Palm Desert"`, not `"Antioch, CA"`), and that Postgres case-insensitive matching (`mode: "insensitive"`) returns identical results to exact-case matching against real data (12,924 rows either way for `"Los Angeles"` / `"los angeles"`).
- **Single fallback rule, no special-casing:** resolve the candidate city (detected, or `"Unknown"`/absent if undetectable), count matching listings (`status IN (Active, ComingSoon, ActiveUnderContract)` AND `city = <candidate>`, case-insensitive). If that count is **fewer than 4**, use **`"Los Angeles"`** instead. This one rule covers both "no city detected at all" (0 matches) and "city detected but sparse inventory" (1-3 matches) — confirmed `"Los Angeles"` alone has 12,924 matching listings today, comfortably clear of the threshold.
- The threshold of 4 comes from the marquee's rendering mechanics: `ListingsMarquee` doubles its input array (`[...listings, ...listings]`) to create a seamless scroll loop, and roughly 4-5 cards are visible in the viewport at once at typical desktop width (each card ~308px including gap). Fewer than 4 source listings means the same property would visibly repeat within a single screen's width.

**Returns:** `{ city: string; count: number }` — the resolved city (post-fallback) and its total matching-listing count, for both the marquee query and (on the homepage) the title's "{X}+" figure.

### 2. `getFeaturedListings()` gains a city parameter

`apps/web/src/lib/listings.ts`'s `getFeaturedListings()` changes from no arguments to `getFeaturedListings(city: string)`, adding `city: { equals: city, mode: "insensitive" }` to its existing `where` clause (same `status`/`orderBy`/`take: 8`/`select` otherwise unchanged). Both `FeaturedListingsServer.tsx` (homepage) and `BuySearchListingsServer.tsx` (Buy page) resolve the visitor's city via the new helper and pass it in — this is the one shared mechanism both pages use identically.

No new index is required — `Property` already has both a plain `@@index([city])` and a `@@index([status, listingType])` (plus GIN trigram indexes on `city`/`address` from earlier work); a `status IN (...) AND city = X` query is well-served by the existing indexes at this data scale, consistent with how other ad-hoc filter combinations already perform on this schema without a dedicated compound index.

### 3. Homepage title — replaces "Exclusive Listings"

`apps/web/src/components/home/FeaturedListings.tsx`'s title changes from the static gold-accented "Exclusive **Listings**" to a dynamic, count-and-city headline, styled with the same two-line staggered `RevealLine` pattern already used elsewhere on the site (e.g. `BuyFeatures`' "One stop **SHOP**"):

- Line 1 (dark, regular): **"{count}+ Listings in"**
- Line 2 (gold accent, medium weight): **"{city}"**

Differences from eXp's original copy, per Ryan: "Homes" → "**Listings**"; no ", CA" suffix (state omitted — CnC only operates in California, so it's redundant). The city name gets the gold-accent treatment (matching every other emphasized/dynamic word sitewide — "SHOP", "Search", "Smarter" — rather than eXp's plain bold-black city name), for brand consistency.

`count` is the resolved `{ count }` from the city-detection helper (total matching listings for that city, not just the 8 shown in the marquee) — always rendered with a trailing "+", matching eXp's convention.

### 4. Buy page title — "Search Here"

`apps/web/src/components/buy/BuySearchListings.tsx`'s title changes from "Start Your **Search**" to **"Search **Here**"**, restyled to match the *`HomeValueTeaser`* ("Sell **Smarter**") single-line pattern exactly — one `RevealLine`, "Search " (dark) + "**Here**" (gold, medium weight) — rather than the two-line staggered pattern it currently uses.

The Buy page's marquee content **is** city-filtered (same mechanism as the homepage, same fallback rule), but the title does **not** display the city name or a count — it's a static "Search Here" regardless of which city's listings are showing underneath.

---

## What is explicitly NOT touched

- The Buy page's search bar (`PlaceholdersAndVanishInput`) and its submit-to-`/properties` behavior — unaffected, still searches sitewide regardless of the visitor's detected city.
- `/properties`, `FilterBar.tsx`, `PropertyMapInner.tsx`, `SearchResults.tsx` — this feature only affects the two marquee sections and their titles.
- No new database index — existing indexes are sufficient at current data scale (see §2).
- No client-side geolocation, no permission prompt — server-side IP inference only, per Vercel's already-covered privacy-policy language ("Approximate location inferred from IP address...").

---

## Open items for the implementation plan

- Exact placement/naming of the new city-detection helper (`lib/visitor-city.ts` vs. folding it directly into `lib/listings.ts`) — either is reasonable, decide at planning time.
- `getFeaturedListings()`'s signature change (adding a required `city` parameter) touches both existing call sites (`FeaturedListingsServer.tsx`, `BuySearchListingsServer.tsx`) — both need updating in the same change, not sequenced separately, since an intermediate state with only one call site updated would fail to compile.
- Since Vercel's geo header is absent in local dev, the fallback-to-Los-Angeles path is the *only* path exercisable via `pnpm dev` — real per-visitor-city behavior can only be verified after deployment (production or preview), same caveat already true of the underlying Buy-page-section work.
- Test coverage for the city-detection helper's header-parsing/decoding/fallback-threshold logic should be straightforward unit tests (pure function once the header value is extracted) mocking Prisma for the count check, following this codebase's existing test conventions.
