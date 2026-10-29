# City Search Pages + Six Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google-only city landing pages (`/homes-for-sale/<city>`) that reuse the Search page, plus six small fixes (activity log, admin pencil dropdown, pop-up labels, three phone fixes).

**Architecture:** A daily cron counts active for-sale listings per city in the 6 SoCal counties and saves the qualifying cities (≥20 listings, with a centre point) to Redis. The city page is an hourly-cached (ISR) server page that loads exactly what `/properties?query=<City>` loads, renders the existing `SearchResults` seeded with that query (no URL read, so the cards are in the HTML), plus one visible "Nearby" links line. Sitemap lists the cities from Redis. The six fixes are local edits to existing components.

**Tech Stack:** Next.js 14 App Router, Prisma (Neon), Upstash Redis, Vitest (node env, `renderToStaticMarkup` for components).

**Spec:** Approved in chat 2026-10-29 (Ryan): city pages are new pages only — no navbar/footer links, existing pages unchanged; 6 SoCal counties; a city qualifies while it has ≥ 20 active for-sale listings; heading **hidden** (sr-only, like `/properties`); nearby-city links **one visible line above the cards**; option B links (nearby cities only). Six fixes approved as listed in the conversation the same day.

## Global Constraints

- Desktop of every existing page must not change, except: the extra Activity text (fix 1), the greyed "(current)" option (fix 2), invisible pop-up labels (fix 3).
- Phone-only classes use `max-lg:` / `max-sm:` prefixes.
- No new libraries. No new per-visit database query on any existing page.
- Counties (exact DB values): `Los Angeles`, `Orange`, `Riverside`, `San Bernardino`, `San Diego`, `Ventura`. Threshold: `20`. Nearby cities shown: `6`.
- Local dev and production share one Neon DB and one Redis — never run the full seed.
- Every task: `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`; the final task also runs a clean production build.

## Review Focus

1. A city slug that isn't in the saved list (or the list is missing) → 404, never a crash or an empty "0 homes" page.
2. City names with accents/spaces/periods ("La Cañada Flintridge", "St. Helena") → stable lowercase-hyphen slugs, round-trip to the right city.
3. Changing a filter on a city page → goes to the normal `/properties?…` search (same as today's search page behaviour).
4. `/properties` itself still reads the URL exactly as before (query, filters, Clear).
5. The pill-scroll fix must do nothing on desktop (vertical sidebar is not horizontally scrollable).

---

### Task 1: City list (daily job + Redis)

**Files:**
- Create: `apps/web/src/lib/city-pages.ts`, `apps/web/src/app/api/cron/city-pages/route.ts`
- Modify: `apps/web/vercel.json` (add cron `{"path":"/api/cron/city-pages","schedule":"20 9 * * *"}`)
- Test: `apps/web/src/__tests__/lib/city-pages.test.ts`

**Interfaces — Produces:**
- `type CityPage = { slug: string; name: string; county: string; count: number; lat: number; lng: number }`
- `CITY_PAGE_COUNTIES` (the 6 names), `CITY_PAGE_MIN_LISTINGS = 20`, `CITY_PAGES_KEY = "listings:city-pages"`
- `citySlug(name: string): string` — NFD, strip diacritics, lowercase, non-alphanumerics → `-`, trim dashes.
- `nearbyCities(city: CityPage, all: CityPage[], n = 6): CityPage[]` — nearest by haversine, excluding itself.
- `refreshCityPages(): Promise<{ cities: number }>` — one `$queryRaw` over `Property` where `status IN ACTIVE_STATUSES`, `"listingType" = 'FOR_SALE'`, `county IN (6)`, `latitude/longitude NOT NULL`; `GROUP BY lower(city)`; selects `mode() WITHIN GROUP (ORDER BY city)` as name, `mode() … county`, `count(*)::int`, `avg(latitude)`, `avg(longitude)`; keeps `count >= 20`; `redis.set(CITY_PAGES_KEY, JSON.stringify(list), { ex: 3 * 24 * 3600 })`.
- `getCityPages(): Promise<CityPage[] | null>` — via `redisReadOrNull` (`lib/property-count-cache.ts`); null when missing/unreadable.
- Route: same shape as `api/cron/listing-counts/route.ts` (`isAuthorizedCronRequest`, `maxDuration = 300`, `GET = POST`).

- [ ] **Step 1: Failing tests** — `citySlug("La Cañada Flintridge") === "la-canada-flintridge"`, `citySlug("St. Helena") === "st-helena"`, `citySlug("  Los  Angeles ") === "los-angeles"`; `nearbyCities` returns the 2 closest of 4 fixtures in distance order and never the city itself; `refreshCityPages` (mocked prisma/redis) drops a 19-listing row, keeps a 20-listing row, writes JSON under `listings:city-pages`; `getCityPages` returns null when redis returns null.
- [ ] **Step 2:** Run `pnpm --filter web test city-pages` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests PASS, tsc clean.
- [ ] **Step 5:** Commit `feat: daily city list for city search pages`.

### Task 2: Shared search-page loader

**Files:**
- Create: `apps/web/src/lib/property-search-page.ts`
- Modify: `apps/web/src/app/(listings)/properties/page.tsx` (use the loader; JSX unchanged)
- Test: `apps/web/src/__tests__/lib/property-search-page.test.ts`

**Interfaces — Produces:** `searchPageWhere(params: SearchPageParams): Record<string, unknown>` (the exact where the page builds today) and `loadSearchPage(params): Promise<{ properties: PropertyListing[]; total: number }>` (same select, `orderBy listedAt desc`, `take 20`, `cachedCount(countCacheKey(where), …)`). `SearchPageParams` = the page's current `searchParams` shape.

- [ ] Step 1: Failing tests — `searchPageWhere({})` equals `{ status: { in: ["Active","ComingSoon","ActiveUnderContract"] }, listingType: "FOR_SALE" }`; `searchPageWhere({ query: "Cerritos" })` includes `buildLocationWhere("Cerritos")`; MultiFamily/Commercial/price/beds/baths branches match the current page code.
- [ ] Step 2: FAIL. Step 3: implement by moving the page's code. Step 4: PASS + tsc. Step 5: commit `refactor: share the search page loader`.

### Task 3: SearchResults seeded mode + nearby line

**Files:**
- Modify: `apps/web/src/hooks/useSearchFilters.ts`, `apps/web/src/components/properties/SearchResults.tsx`
- Test: `apps/web/src/__tests__/components/SearchResults.test.ts`

**Interfaces — Produces:**
- `useFilterState(initial: SearchFilters)` — the current state + `applyFilters` + `clearFilters` + `hasActiveFilters` logic (both still `router.replace` to `/properties…`).
- `useSearchFilters()` = `useFilterState(filtersFromParams(useSearchParams()))` (unchanged behaviour). Export `filtersFromParams`.
- `SearchResults` props gain `initialFilters?: SearchFilters` and `nearby?: { name: string; href: string }[]`. With `initialFilters` it renders the view **without** reading the URL (no Suspense needed, so SSR/ISR HTML contains the cards); without it, exactly today's Suspense + URL path.
- `NearbyCities({ cities })` exported: one line at the top of the list grid (`col-span-2 max-sm:col-span-1`), "Nearby:" then `<Link>`s separated by " · ", `text-xs text-white/50`, links `text-white/70 hover:text-[#9E8C61]`. Rendered only when `nearby?.length`.

- [ ] Step 1: Failing tests — `filtersFromParams(new URLSearchParams("query=Cerritos&minBeds=3"))` → query "Cerritos", minBeds "3", listingType "FOR_SALE"; `renderToStaticMarkup(NearbyCities({cities:[{name:"Artesia",href:"/homes-for-sale/artesia"}]}))` contains `href="/homes-for-sale/artesia"` and "Nearby"; empty list renders "".
- [ ] Step 2: FAIL. Step 3: implement (split `SearchResultsInner` into a view that receives the filter state). Step 4: PASS + tsc. Step 5: commit `feat: search results can start from a given city`.

### Task 4: City page route + sitemap

**Files:**
- Create: `apps/web/src/app/(listings)/homes-for-sale/[city]/page.tsx`
- Modify: `apps/web/src/app/sitemaps/[name]/route.ts` (`pagesEntries` appends `${SITE_URL}/homes-for-sale/${slug}` for each saved city; missing list → none)
- Test: `apps/web/src/__tests__/lib/city-pages.test.ts` (add `cityPageMeta`), sitemap test if one exists

**Interfaces — Consumes:** Task 1 `getCityPages`, `nearbyCities`; Task 2 `loadSearchPage`; Task 3 props. **Produces:** `cityPageMeta(city: CityPage): Metadata` in `lib/city-pages.ts` — title `Homes for Sale in ${name}, CA | CnC Realty`, description `Browse ${count}+ homes for sale in ${name}, CA, updated from the MLS every 15 minutes.`, canonical `/homes-for-sale/${slug}` (reuse `canonicalMeta` from `lib/seo.ts` if its signature fits).

Page: `export const revalidate = 3600; export const dynamicParams = true; export function generateStaticParams() { return []; }`. Find the city by slug in `getCityPages()`; not found or list null → `notFound()`. Render `<h1 className="sr-only">Homes for Sale in {name}, CA</h1>` and `<SearchResults initialProperties initialTotal initialFilters={{...DEFAULT_FILTERS, query: name}} nearby={…} />`; on load error, same fallback block as `/properties`.

- [ ] Step 1: Failing test for `cityPageMeta`. Step 2: FAIL. Step 3: implement page + sitemap. Step 4: PASS + tsc. Step 5: commit `feat: city search pages`.

### Task 5: Activity log lists rows made optional

**Files:** Modify `apps/web/src/app/api/transactions/[id]/representation/route.ts`, `apps/web/src/lib/activity-detail.ts`. Test: `__tests__/lib/activity-detail.test.ts`.

- Route payload adds `demoted`: short names of rows in `plan.requiredUpdates` with `isRequired: false` that are not in the new template (already in memory).
- Line: `… — Added: X; Removed: Y; Made optional: Z`. Older entries (no `demoted`) unchanged.
- [ ] TDD: failing test for the new part + unchanged old payload → implement → PASS → commit `feat: representation activity lists rows made optional`.

### Task 6: Pencil dropdown marks the current type

**Files:** Modify `apps/web/src/components/transactions/InfoRow.tsx` (`InfoRowEdit.currentOption?: string`; that option renders `"{o} (current)"`, `disabled`), `apps/web/src/components/transactions/OverviewTab.tsx` (representation edit passes `currentOption: transactionSideLabel(current side)`). Test: new `__tests__/components/InfoRow.test.ts` if InfoRow can render in edit mode statically; otherwise test an exported `selectOptionLabel(o, current)` helper.

- [ ] TDD → commit `feat: representation dropdown marks the current type`.

### Task 7: Pop-up labels for screen readers (batch)

**Files (16):** `components/deals/DealDrawer.tsx`, `deals/NewDealModal.tsx`, `home/ServicesSection.tsx` (lead-capture modal), `home-value/RevealEstimateForm.tsx`, `leads/AssignLeadModal.tsx`, `leads/LeadTasksTab.tsx` (drawer), `leads/NewLeadModal.tsx`, `leads/RelationshipSection.tsx`, `leads/SmartListDrawer.tsx`, `properties/PropertyCard.tsx` (login modal), `properties/PropertyDrawer.tsx`, `transactions/ConvertListingModal.tsx`, `ui/ContactModal.tsx`, `ui/PhotoLightbox.tsx`, `app/(dashboard)/admin/leads/AdminLeadsClient.tsx`, `admin/leads/AdminLeadsMergeClient.tsx`.

- Add `role="dialog" aria-modal="true" aria-label="<the pop-up's visible title>"` to each pop-up's panel element (the one holding the content, not the backdrop), the same way `ActionPlanDrawer.tsx` does. Attributes only — no class changes.
- Test: one render test where a component renders statically (e.g. `ConvertListingModal`, `PhotoLightbox`) asserting `role="dialog"` and `aria-modal="true"`.
- [ ] Commit `a11y: label 16 pop-ups as dialogs`.

### Task 8: Three phone fixes

**Files:** `apps/web/src/components/leads/SmartListSidebar.tsx`, `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx`. Create `apps/web/src/lib/pill-scroll.ts`. Test `__tests__/lib/pill-scroll.test.ts`.

- `pillScrollLeft(view: {left: number; width: number; scrollLeft: number}, pill: {left: number; width: number}): number | null` — null when the pill is fully visible; otherwise the scrollLeft that brings it into view with 16px margin (left edge if it's off to the left, right edge if off to the right). Positions are viewport rects.
- SmartListSidebar: ref on the row container; `useEffect` on `[selected, lists]` finds the selected button (`data-selected="true"`), applies `pillScrollLeft`; desktop column isn't horizontally scrollable so assigning scrollLeft is a no-op.
- ✎ / × buttons: add `max-lg:min-h-11 max-lg:min-w-11` (44px).
- Tasks: add `PHONE_WRAP_TEXT` to both lead-name lines (open row line 48 and completed-tasks line).
- [ ] TDD the helper (visible → null; off right → right-aligned value; off left → left value) → implement → commit `fix: phone pill scroll, 44px list buttons, lead name wraps`.

### Task 9: Verify

- [ ] Full tests, tsc, `rm -rf apps/web/.next && pnpm --filter web build` (route-size table: `/properties` first-load JS unchanged ±0.5 KB; new route present).
- [ ] Run the city job once locally (`refreshCityPages` via the cron route with `CRON_SECRET`), confirm ~390 cities saved, open `/homes-for-sale/cerritos`, `/homes-for-sale/not-a-city` (404), sitemap includes city URLs, view-source contains cards + Nearby links.
- [ ] Desktop pixel check vs baseline build: `/properties`, `/dashboard/leads`, `/dashboard/tasks` at 1440 — identical.
- [ ] Targeted speed check: `/properties` desktop 1440 + phone 390 (old vs new), city page cold vs warm.
- [ ] Ask Ryan before pushing.
