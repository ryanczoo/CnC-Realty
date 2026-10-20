# SEO Foundation (Steps 2 + 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what Google and Bing read on cncrealtygroup.com (sitemap, canonicals, titles, headings, business data, listing pages, search-page listings, Join stats, IndexNow) with zero visible change and no speed loss.

**Architecture:** One small SEO module (`lib/seo.ts`) owns every page's title/description/canonical/Open Graph so pages call one helper. Business JSON-LD moves to the root layout. The sitemap becomes a sitemap index served at the same `/sitemap.xml` URL (already submitted to Google/Bing) with child files under `/sitemaps/`. Hidden `<h1>`s use Tailwind `sr-only` (absolutely positioned, no layout effect).

**Tech Stack:** Next.js 14.2.35 App Router metadata API, Prisma, vitest (environment `node`, `.test.ts` files; render components with `react-dom/server` `renderToStaticMarkup` + `React.createElement`), sharp (already a dependency).

**Spec:** `docs/superpowers/specs/2026-10-19-seo-foundation-design.md` (read its "Ryan's answers" section — it overrides earlier sections).

## Global Constraints

- **No visible change on desktop or phones.** Every public page pixel-identical before/after at rest and through animations. Browser-tab titles and Google result text may change.
- **No speed regression** desktop or phone. Measure before/after; any item that slows a page is dropped.
- **Reuse before creating:** `lib/json-ld.ts` (`jsonLdScriptSafe` for every embed), `VideoMaskHero`, `ScrambleValue`, `ACTIVE_STATUSES` (`lib/listing-counts.ts`), `PHONE_*` bundles in `lib/dashboard-phone.ts`.
- Brand string is exactly **"CnC Realty"** — never "CnC Realty Group" in titles, descriptions or business data. Base URL `https://cncrealtygroup.com` (no www).
- Root title template `"%s | CnC Realty"`; default title `"CnC Realty | California Real Estate Brokerage"`.
- Business facts (from the footer): 830 S. Main St, STE 227, Santa Ana, CA 92701 · info@cncrealtygroup.com · CA DRE #02439028 · sameAs `https://www.facebook.com/CnCRealtyGroup`, `https://www.instagram.com/cncrealty`, `https://www.youtube.com/@CnCRealtyGroup`. No phone yet.
- `/manage` description keeps "Southern California"; every other page says California.
- After every task: `pnpm --filter web test` (all pass), `pnpm --filter web exec tsc --noEmit` (clean). Tasks touching pages/components also run `rm -rf apps/web/.next && pnpm --filter web build` (a past change once broke the build while vitest+tsc passed). Stop the dev server before building the same `.next`.
- No push. Ryan approves pushes separately (push to `main` deploys live).
- Pixel/speed tooling lives in `.superpowers/pf-survey/` (git-ignored): `viewsPF.cjs` + `abPF.cjs` (old build vs new build, desktop 1440×900 / 1024×768), `leftoverPF.cjs`-style phone runs at 390×844, 375×667, 844×390, speed script with `MSYS_NO_PATHCONV=1`. Old build: `git worktree add ../CnC-old <base-sha>`, `next build`, `next start <abs app dir> -p 3100`; new build on 3101. Confirm each server's BUILD_ID before comparing.

## Review Focus

1. **Listing whose status flips to Closed** → page still loads for visitors, gets `noindex`, JSON-LD has no `offers`. (Task 3 tests a Closed and a Pending listing.)
2. **Agent slug or press slug containing `&`/`<`** → sitemap XML stays valid (escaped). (Task 6 test.)
3. **Zero active listings / DB error while building the sitemap** → index still returns the pages sitemap and valid XML, never a 500. (Task 6 test.)
4. **IndexNow endpoint down or slow** → IDX sync still finishes and records `idx_last_sync_at`. (Task 7 test with a rejecting/hanging fetch.)
5. **Screen readers on hero pages** → heading read once (SVG lettering `aria-hidden`), and Join stats read the real value, not dashes. (Tasks 4 and 5 markup tests.)

---

### Task 1: Page titles, descriptions, canonicals, default link preview

**Files:**
- Create: `apps/web/src/lib/seo.ts`
- Create: `apps/web/public/og-default.jpg` (from Ryan's image)
- Create: `apps/web/src/app/(marketing)/contact/layout.tsx`, `apps/web/src/app/(marketing)/home-value/layout.tsx`
- Modify: `apps/web/src/app/layout.tsx` (metadata), `apps/web/src/app/page.tsx` (homepage metadata), `app/(marketing)/{buy,sell,rent,manage,join,accessibility,privacy,terms,fair-housing}/page.tsx`, `app/press/page.tsx`, `app/(listings)/properties/page.tsx`
- Test: `apps/web/src/__tests__/lib/seo.test.ts`

**Interfaces:**
- Produces: `SITE_URL = "https://cncrealtygroup.com"`, `BRAND = "CnC Realty"`, `OG_IMAGE = { url: "/og-default.jpg", width: 1200, height: 630, alt: "CnC Realty" }`,
  `PAGE_SEO: Record<SeoPath, { title: string; absolute?: boolean; description: string }>` where `SeoPath` is the union of the static paths below,
  `pageMeta(path: SeoPath): Metadata` (title — `{ absolute }` when flagged — description, `alternates.canonical: path`, `openGraph: { title: <full title>, description, url: path, siteName: BRAND, type: "website", images: [OG_IMAGE] }`),
  `canonicalMeta(path: string, title: string, description: string, images?: OpenGraph images): Metadata` for dynamic pages (Task 3).

- [ ] **Step 1: Make the preview image.** One-off script (scratchpad, not committed) with sharp: read `C:\Users\hey_r\Downloads\Screenshot 2026-10-19 172258.png` (1885×867), centre-crop to width `round(867*1.91)=1656` (`left = 114`), resize to 1200×630, `jpeg({ quality: 82, mozjpeg: true })` → `apps/web/public/og-default.jpg`. Expect ≤ 200 KB; lower quality if larger. **Show Ryan the file and wait for his OK before continuing** (spec answer 4).

- [ ] **Step 2: Write failing tests** in `seo.test.ts`:
  - `PAGE_SEO` titles equal exactly (spec answer 2): `/buy` "Buy a Home in California", `/sell` "Sell Your Home in California", `/rent` "Homes for Rent in California", `/manage` "Property Management", `/join` "Join CnC Realty | 100% Commission Brokerage in California" (absolute), `/press` "Press", `/home-value` "What's My Home Worth? Free Home Value Estimate", `/contact` "Contact CnC Realty" (absolute), `/properties` "Homes for Sale in California".
  - No `PAGE_SEO` title or description contains "CnC Realty Group" or "Southern California", except `/manage` description which contains "Southern California".
  - `pageMeta("/buy")` → `alternates.canonical === "/buy"`, `openGraph.images[0].url === "/og-default.jpg"`, `openGraph.title === "Buy a Home in California | CnC Realty"`.
  - `pageMeta("/join").title` is `{ absolute: "Join CnC Realty | 100% Commission Brokerage in California" }` and its `openGraph.title` is the same string.
  - `pageMeta("/")` → title `{ absolute: "CnC Realty | California Real Estate Brokerage" }`, canonical `"/"`.
  - Root layout `metadata` has no `alternates` key (import it in the test; mock `@/lib/auth`/`next-auth` as `DashboardOverviewPage.test.ts` does if the import needs it).

- [ ] **Step 3: Run** `pnpm --filter web exec vitest run src/__tests__/lib/seo.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement `lib/seo.ts`.** Paths: `/buy /sell /rent /manage /join /press /home-value /contact /properties /accessibility /privacy /terms /fair-housing`. Keep each page's current description text where it already exists, only removing "CnC Realty Group" (→ "CnC Realty") and fixing `/properties` to: "Search active homes for sale and for rent across California, updated from CRMLS every 15 minutes." New descriptions — `/home-value`: "Get a free estimate of your California home's value based on recent nearby sales." `/contact`: "Contact CnC Realty, a California real estate brokerage. Send us a message and we'll get back to you quickly." Legal pages keep their current titles (e.g. "Privacy Policy").

- [ ] **Step 5: Wire it in.** Root `layout.tsx` metadata: `title: { default: "CnC Realty | California Real Estate Brokerage", template: "%s | CnC Realty" }`, description "California real estate brokerage. Search homes for sale and rent, connect with local agents, and join CnC Realty.", `metadataBase`, `openGraph: { siteName: BRAND, type: "website", images: [OG_IMAGE] }` (no `url`, no `title`), `twitter: { card: "summary_large_image" }`. **No `alternates` in the root layout** — a root canonical is inherited by every page that doesn't set its own (login, apply, unsubscribe…) and would point them all at the homepage. The homepage gets its own `export const metadata` in `app/page.tsx` with `alternates.canonical: "/"` and an `openGraph` with `url: "/"` and the default title (add `"/"` to `PAGE_SEO` with `absolute: true`, title "CnC Realty | California Real Estate Brokerage"). Each listed page replaces its `export const metadata` with `export const metadata = pageMeta("<path>")`. `contact/layout.tsx` and `home-value/layout.tsx` are server components exporting `metadata = pageMeta(...)` and returning `children` unchanged (no wrapper element).

- [ ] **Step 6: Run** the seo tests → PASS; full suite, `tsc`, build pass. In the built server, `curl` `/`, `/buy`, `/join`, `/contact`, `/home-value`, `/properties?query=x` and check: one `<link rel="canonical">` with the expected path (`/properties` for the query URL), `<title>` matches, `og:image` ends `/og-default.jpg`, no "CnC Realty Group" in `<head>`.

- [ ] **Step 7: Commit** `feat(seo): page titles, descriptions, canonicals, default link preview`.

### Task 2: Business details for Google, site-wide

**Files:**
- Modify: `apps/web/src/lib/json-ld.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
- Test: `apps/web/src/__tests__/lib/json-ld.test.ts`

**Interfaces:**
- Produces: `localBusinessJsonLd()` (shape below), `websiteJsonLd()` → `{ "@context", "@type": "WebSite", name: "CnC Realty", url: SITE_URL }`, `agentJsonLd(...)` unchanged signature.

- [ ] **Step 1: Failing tests:** `localBusinessJsonLd()` has `@type` "RealEstateAgent", `name` and `legalName` "CnC Realty", `url` SITE_URL, `logo` `${SITE_URL}/logo-black.png`, `image` `${SITE_URL}/og-default.jpg`, `email` "info@cncrealtygroup.com", `address` `{ "@type": "PostalAddress", streetAddress: "830 S. Main St, STE 227", addressLocality: "Santa Ana", addressRegion: "CA", postalCode: "92701", addressCountry: "US" }`, `areaServed` `{ "@type": "State", name: "California" }`, `sameAs` the three social URLs, `identifier` `{ "@type": "PropertyValue", name: "CA DRE License", value: "02439028" }`, no `telephone`; `JSON.stringify` contains neither "Los Angeles" nor "CnC Realty Group". `agentJsonLd(...).worksFor.name === "CnC Realty"`. `websiteJsonLd()` shape.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; import `SITE_URL` from `lib/seo.ts` instead of the local `BASE`.
- [ ] **Step 4: Move the embed.** Root layout renders one `<script type="application/ld+json">` containing `jsonLdScriptSafe([localBusinessJsonLd(), websiteJsonLd()])` inside `<body>` before `<Providers>`. Remove the homepage's script and its import from `app/page.tsx`.
- [ ] **Step 5: Run** tests, tsc, build → PASS. `curl` `/` and `/buy`: exactly one script containing `"RealEstateAgent"`; listing and agent pages still have their own JSON-LD too.
- [ ] **Step 6: Commit** `feat(seo): correct site-wide business details for Google`.

### Task 3: Listing, agent and press-post pages

**Files:**
- Modify: `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx`, `apps/web/src/lib/json-ld.ts` (`propertyJsonLd`), `apps/web/src/app/(agents)/agents/[slug]/page.tsx`, `apps/web/src/components/agents/AgentHeroSection.tsx`, `apps/web/src/app/press/[slug]/page.tsx`
- Test: `apps/web/src/__tests__/api/property-detail.test.ts` or a new `src/__tests__/components/ListingPageMeta.test.ts` (follow `AgentProfilePage.test.ts`'s mocking of `react` `cache` + `@/lib/prisma`), `json-ld.test.ts`, `AgentProfilePage.test.ts`

**Interfaces:**
- Consumes: `canonicalMeta` (Task 1), `ACTIVE_STATUSES` (`lib/listing-counts.ts`).
- Produces: `propertyJsonLd(p)` gains required `status: string`; `offers` present only when `ACTIVE_STATUSES.includes(status)`.

- [ ] **Step 1: Failing tests.** Listing `generateMetadata` with an `Active` property → title `"{address}, {city}, CA {zip}"`, `alternates.canonical "/properties/{mls}"`, no `robots`, OG image = first listing photo. With `Closed` and with `Pending` → `robots: { index: false, follow: true }`. `propertyJsonLd` with `Closed` has no `offers`; with `ActiveUnderContract` has `offers`. Agent `generateMetadata` → title `"{displayName}"` (template adds the brand), canonical `/agents/{slug}`; not-found title "Agent Not Found". Press post → title `"{post.title}"`, canonical `/press/{slug}`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Listing: the price element becomes `<p>` and the address element becomes `<h1>`, each keeping its exact existing `className` (Tailwind preflight already zeroes heading margins/size, so this is pixel-identical). Pass `status` into `propertyJsonLd`. Agent: `AgentHeroSection`'s sentence `<p className="break-words …">` becomes `<h1>` with the same className (it contains the agent's name). Press post: drop " | CnC Realty Group" from the title (template supplies the brand).
- [ ] **Step 4: Run** tests, tsc, build → PASS. `curl` an active listing, a closed listing (pick an MLS # with status Closed from the DB), an agent page, a press post: one `<h1>`, canonical correct, closed listing has `<meta name="robots" content="noindex, follow">`.
- [ ] **Step 5: Pixel check** listing page + agent page, old vs new build, desktop 1440/1024 and phone 390/375: identical.
BreadcrumbList (spec "if cheap") is deliberately left out — YAGNI.

- [ ] **Step 6: Commit** `feat(seo): listing/agent/press-post headings, canonicals, noindex for off-market listings`.

### Task 4: Hidden main headings on hero pages and search

**Files:**
- Modify: `apps/web/src/components/ui/VideoMaskHero.tsx`, `components/{buy/BuyHero,sell/SellHero,rent/RentHero,manage/ManageHero,blog/PressHero,join/JoinHero}.tsx`, `apps/web/src/app/(listings)/properties/page.tsx`
- Test: `apps/web/src/__tests__/components/VideoMaskHero.test.ts`, new `JoinHero.test.ts`

**Interfaces:**
- Produces: `VideoMaskHero` optional prop `heading?: string`; when set, renders `<h1 className="sr-only">{heading}</h1>` as the section's first child. Both lettering `<svg>`s always carry `aria-hidden="true"`.

- [ ] **Step 1: Failing tests** (renderToStaticMarkup): `VideoMaskHero` with `heading="Buy a Home With CnC Realty"` contains exactly one `<h1 class="sr-only">Buy a Home With CnC Realty</h1>`; without `heading` contains no `<h1`; every `<svg` has `aria-hidden="true"`. `JoinHero` markup contains `<h1 class="sr-only">Be CnC – Join CnC Realty</h1>` and its svgs are `aria-hidden`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Headings (spec answer 2): Buy "Buy a Home With CnC Realty", Sell "Sell Your Home With CnC Realty", Rent "Rent With CnC Realty", Manage "Property Management With CnC Realty", Press "CnC Realty Press", Join "Be CnC – Join CnC Realty" (en dash). Search page returns `<><h1 className="sr-only">Homes for Sale in California</h1><SearchResults …/></>` (also in the catch branch? no — only the success branch).
- [ ] **Step 4: Run** tests, tsc, build → PASS. `curl` each page: exactly one `<h1`.
- [ ] **Step 5: Pixel check** buy, sell, rent, manage, join, press, properties: desktop 1440/1024 and phone 390/375 + sideways 844×390, old vs new: identical.
- [ ] **Step 6: Commit** `feat(seo): readable main headings on hero pages and search`.

### Task 5: Join stats readable without changing the animation

**Files:**
- Modify: `apps/web/src/components/ui/ScrambleValue.tsx` (the `ScrambleValue` component only; `useScramble` untouched)
- Test: `apps/web/src/__tests__/components/ScrambleValue.test.ts`

- [ ] **Step 1: Failing test** (renderToStaticMarkup, `triggered=false`): `ScrambleValue value="100%"` markup contains `<span class="sr-only">100%</span>` and an `aria-hidden="true"` span containing `–––%`; outer element is still a `<p>` with the passed className.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: `<p className={className}><span className="sr-only">{value}</span><span aria-hidden="true">{displayed}</span></p>`.
- [ ] **Step 4: Run** tests, tsc, build → PASS. `curl /join` contains `100%`, `$0`, `24/7`, `30+` as text.
- [ ] **Step 5: Pixel check** all four `ScrambleValue` users — `/join` stats bar (before and after the scramble finishes), homepage listings title, `/home-value` estimate + market stats (use an address that returns an estimate): desktop + phone identical.
- [ ] **Step 6: Commit** `feat(seo): Join stat numbers readable to search engines`.

### Task 6: Sitemap index with every public page and listing

**Files:**
- Delete: `apps/web/src/app/sitemap.ts`
- Create: `apps/web/src/lib/sitemap.ts`, `apps/web/src/app/sitemap.xml/route.ts`, `apps/web/src/app/sitemaps/[name]/route.ts`
- Test: `apps/web/src/__tests__/lib/sitemap.test.ts`, `apps/web/src/__tests__/api/sitemap-routes.test.ts`

**Interfaces:**
- Produces: `LISTINGS_PER_SITEMAP = 40_000`; `STATIC_SITEMAP_PATHS` (`/`, `/buy`, `/sell`, `/rent`, `/manage`, `/join`, `/press`, `/home-value`, `/contact`, `/properties`, `/accessibility`, `/privacy`, `/terms`, `/fair-housing`); `escapeXml(s: string): string`; `urlsetXml(entries: { loc: string; lastmod?: Date }[]): string`; `sitemapIndexXml(locs: string[]): string`; `listingSitemapCount(total: number): number` (`max(0, ceil(total / 40_000))`); `EXCLUDED_AGENT_SLUGS = ["claude-test-agent"]`.
- Routes: `/sitemap.xml` → index of `/sitemaps/pages.xml` + `/sitemaps/listings-0.xml` … `listings-{n-1}.xml`. `/sitemaps/pages.xml` → static paths + agents (slug not in the excluded list, `lastmod` = `updatedAt`) + published press posts (`/press/{slug}`). `/sitemaps/listings-{i}.xml` → active listings (`status in ACTIVE_STATUSES`, both listing types) ordered by `mlsNumber`, `skip i*40000`, `take 40000`, `lastmod` = `updatedAt`. Unknown name → 404. All responses `Content-Type: application/xml`, `export const revalidate = 3600`.

- [ ] **Step 1: Failing unit tests:** `escapeXml("a&b<c")` → `"a&amp;b&lt;c"`; `urlsetXml` output starts with `<?xml version="1.0" encoding="UTF-8"?>`, uses namespace `http://www.sitemaps.org/schemas/sitemap/0.9`, escapes locs, writes `lastmod` as ISO; `sitemapIndexXml` uses `<sitemapindex>`; `listingSitemapCount(0)=0`, `(40000)=1`, `(40001)=2`, `(190000)=5`.
- [ ] **Step 2: Failing route tests** (mock `@/lib/prisma`): index lists `pages.xml` + one listings file per 40k (count mocked 85,000 → 3 files); `pages.xml` contains `https://cncrealtygroup.com/buy`, an agent URL, a press URL, never `/about` and never `claude-test-agent`; `listings-1.xml` queries `skip: 40000, take: 40000`; `listings-x.xml` → 404; prisma throwing in the index → still 200 with `pages.xml` only; prisma throwing in `pages.xml` → 200 with the static paths only.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** (select only `mlsNumber`/`slug`/`updatedAt`; never touch dashboard query paths). Keep `robots.ts` pointing at `https://cncrealtygroup.com/sitemap.xml` (already submitted to Google/Bing).
- [ ] **Step 5: Run** tests, tsc, build → PASS (build output must show `/sitemap.xml` as a route, no conflict). Against the local built server (shares the Neon DB): fetch the index and every child; each parses as XML; total listing URLs ≈ live active count (`check` with a one-off Prisma count); each file < 50,000 URLs and < 50 MB; time each child (note it — it's cached 1 h).
- [ ] **Step 6: Commit** `feat(seo): sitemap index with every public page, agent, press post and active listing`.

### Task 7: IndexNow pings after each delta sync

**Files:**
- Create: `apps/web/src/lib/indexnow.ts`, `apps/web/src/app/indexnow-key.txt/route.ts`
- Modify: `apps/web/src/app/api/idx/sync/route.ts`
- Test: `apps/web/src/__tests__/lib/indexnow.test.ts`, `apps/web/src/__tests__/api/idx-sync.test.ts`

**Interfaces:**
- Produces: `buildIndexNowPayload(urls: string[], key: string): { host: "cncrealtygroup.com"; key: string; keyLocation: "https://cncrealtygroup.com/indexnow-key.txt"; urlList: string[] }` (dedupes, caps at 10,000), `pingIndexNow(urls: string[]): Promise<void>` — no-op when `process.env.INDEXNOW_KEY` is unset or `urls` is empty; POSTs JSON to `https://api.indexnow.org/indexnow` with a 5 s `AbortSignal.timeout`; never throws (logs).
- Route `/indexnow-key.txt` returns `INDEXNOW_KEY` as `text/plain`, 404 when unset.

- [ ] **Step 1: Failing tests:** payload dedupes and caps at 10,000; `pingIndexNow` does nothing without the env var; a rejecting `fetch` and an aborted (timeout) fetch both resolve without throwing; sync test: a `delta` run whose upserts succeed for MLS `A`,`B` calls `pingIndexNow` with `[".../properties/A", ".../properties/B"]` (both new/updated and status-changed listings — every successful upsert), a `full` run never calls it, and a `pingIndexNow` rejection still lets `runSync` return its totals.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** In `runSync`, collect `mlsNumber` of each fulfilled upsert; after the crawl (and after the existing completion bookkeeping), `if (type !== "full") await pingIndexNow(urls)`. Generate a 32-hex key for `INDEXNOW_KEY`; add it to `apps/web/.env.local`; **tell Ryan it must be added in Vercel before deploy** (flag again at push time).
- [ ] **Step 4: Run** tests, tsc, build → PASS; `curl /indexnow-key.txt` on the built server returns the key.
- [ ] **Step 5: Commit** `feat(seo): IndexNow notifications after each listing delta sync`.

### Task 8: Search-page listings in the first HTML (conditional)

**Files:**
- Modify: `apps/web/src/components/properties/SearchResults.tsx` (and possibly `PropertyMap.tsx`)
- Test: `apps/web/src/__tests__/components/SearchResults.test.ts`

Ryan's condition (spec answer 5): desktop AND phone load no slower than today, no flicker/jump on load, settled page pixel-identical. **If any check fails, revert this task entirely and report** — the sitemap already covers listings.

- [ ] **Step 1: Find the cause.** Run the dev server, `curl -s localhost:<port>/properties`, read the `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING" data-msg=… data-stck=…>` attributes (dev mode includes the reason and stack). Record which hook/component throws (candidates: `useSearchParams` in `useSearchFilters`, or the `next/dynamic` `ssr:false` map boundary under the single `<Suspense>`).
- [ ] **Step 2: Failing test** (renderToStaticMarkup or a production-build `curl`, whichever the cause allows): first HTML of `/properties` contains ≥ 1 `href="/properties/<mls>"` card link and no `BAILOUT_TO_CLIENT_SIDE_RENDERING` around the card list. If only verifiable via the built server, write it as a scripted check in the verification step instead and say so in the commit.
- [ ] **Step 3: Implement the narrowest fix** — give the thrower its own `<Suspense>` boundary (fallback identical to what renders there today) so only it renders client-side. Keep the `phoneAtLoad` / `MapPlaceholder` shape rules documented in `SearchResults.tsx` and `PropertyMap.tsx` intact (a mismatched shape discards the whole server HTML).
- [ ] **Step 4: Verify** (built servers, old vs new): first HTML has 20 card links; browser console has no hydration warnings at 1440×900 and 390×844; settled pixels identical at 1440/1024/390/375/844×390; phone load shows no jump (screenshot sequence 0/250/500/1000 ms after navigation); speed — 5 runs each, desktop and phone throttled, median time to first card visible and load event: new ≤ old. Also note the HTML size change.
- [ ] **Step 5: Commit** `feat(seo): search results present in the page's first HTML` — or revert and report which check failed.

### Task 9: Whole-site verification

- [ ] **Step 1:** Full suite, `tsc`, clean build.
- [ ] **Step 2: Pixel A/B**, old build (base = commit before Task 1) vs new: every public page — home, buy, sell, rent, manage, join, join/apply, press, a press post, home-value (with estimate), contact, properties, an active listing, a closed listing, an agent page, login, legal pages — at 1440×900, 1024×768, 390×844, 375×667, 844×390, including scrolled states the existing `viewsPF.cjs` covers. Everything identical.
- [ ] **Step 3: Speed A/B**, desktop + throttled phone, 5 runs each on home, buy, join, properties, a listing: new ≤ old beyond run-to-run noise; first-load JS per route from the build output unchanged (±0.1 KB).
- [ ] **Step 4: Head check** per page: one canonical, one h1, title has "CnC Realty" once, valid JSON-LD (parse each script), no "Los Angeles"/"CnC Realty Group"; sitemap index + children parse.
- [ ] **Step 5:** Report results to Ryan; list the Vercel env var `INDEXNOW_KEY`; ask before pushing. After deploy: remind Ryan to check Search Console sitemap status + request indexing for the main pages, and Bing "URLs discovered" (memory: post-SEO-fix reminders). Then stop the 3100/3101 servers and `git worktree remove` the old-build worktree.
