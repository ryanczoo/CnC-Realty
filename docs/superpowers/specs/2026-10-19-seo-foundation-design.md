# SEO Foundation (Steps 2 + 3) — Design

Date: 2026-10-19 · Owner: Ryan · Status: answers in from Ryan — awaiting final approval

## Why

CnC wants organic leads without paying an SEO firm. Priority is **recruiting agents** (experienced producers
leaving other brokerages), then buyers/sellers. Google Search Console, Bing Webmaster Tools and a Google
Business Profile were set up on 2026-10-19 (profile name **"CnC Realty"**, the DRE-registered name; service-area
business, address hidden). This project fixes what Google and Bing *read* on the live site so those accounts
have something correct to index.

## Hard constraints (Ryan's rules)

1. **No visible change on desktop or phones.** Every public page must look pixel-identical before/after at
   rest and through its animations, verified with the existing `.superpowers/pf-survey` A/B tooling (old build on
   one port, new build on another; desktop 1440×900 + 1024×768, upright and sideways phones). Browser-tab
   titles and Google result text are allowed to change (they are not on the page).
2. **No speed regression** on desktop or phone. Speed-check before/after (first-load JS from the build output +
   the existing speed script). Any item that slows a page is dropped, not tuned around.
3. **Reuse shared components/helpers first** (`lib/json-ld.ts`, `VideoMaskHero`, `ScrambleValue`,
   `ACTIVE_STATUSES` in `lib/listing-counts.ts`, etc.) before adding new ones.
4. Ask before every push (push to `main` deploys live). No DB migrations expected; flag if one appears.
5. Out of scope: Step 4 (recruiting/region pages) and Step 5 (city pages) — Ryan is still deciding.

## Findings this design responds to (verified 2026-10-18/19)

- Live `/sitemap.xml` has 5 URLs. `app/sitemap.ts` is statically built; on Vercel its Prisma query returns
  nothing at build time (locally the same code yields 50,006 URLs). It also lists `/about` (404), omits most
  public pages, and 50,006 is over the 50,000-URL-per-file limit. ~190K listings are active.
- No `<link rel="canonical">` on any page.
- Titles double the brand: root template is `"%s | CnC Realty Group"` while pages already end in
  `| CnC Realty` (e.g. "Buy a Home | CnC Realty | CnC Realty Group"). `/contact` and `/home-value` are
  `"use client"` pages, so they fall back to the generic root title/description.
- No `<h1>` on Buy, Sell, Rent, Manage, Join, Press index (hero words are SVG `<text>` inside a mask via
  `VideoMaskHero` / `JoinHero` / `PressHero`), `/properties`, agent pages. Listing page `<h1>` is the price.
- Homepage JSON-LD (`localBusinessJsonLd`) says name "CnC Realty Group", locality "Los Angeles", no street, no
  phone, logo `logo-white.png` (white on transparent). Footer already shows the true details:
  830 S. Main St, STE 227, Santa Ana, CA 92701 · info@cncrealtygroup.com · CA DRE #02439028 · Facebook
  /CnCRealtyGroup, Instagram /cncrealty, YouTube /@CnCRealtyGroup.
- `/properties` server-fetches 20 listings, but the HTML contains no cards: `SearchResults` wraps everything in
  one `<Suspense>` and the tree bails out to client-side rendering (`BAILOUT_TO_CLIENT_SIDE_RENDERING`).
- Join page stat numbers render as dashes in HTML ("–––% Commission") because `useScramble` starts from a
  dashed placeholder; the "$0/month forever" price IS already in HTML (no change needed there).
- `/manage` description says "Southern California"; other pages say California.

## What to build

### A. Sitemap (`app/sitemap.ts`)
- Render on request with caching (not at build), e.g. `revalidate` ~1h, so the DB is reached at runtime.
- Split into multiple files under the 50,000-URL limit (Next `generateSitemaps` / sitemap index): static pages,
  agents, press posts, listings in chunks. Robots.txt must point at whatever the index URL becomes.
- Static set: `/`, `/buy`, `/sell`, `/rent`, `/manage`, `/join`, `/press`, `/home-value`, `/contact`,
  `/properties`. Remove `/about`. Legal pages (privacy/terms/accessibility/fair-housing) optional, low priority.
  Exclude auth, account, dashboard, admin, apply/submitted, setup-account, unsubscribe, `/join/ica`.
- Listings: `ACTIVE_STATUSES`, both FOR_SALE and FOR_LEASE. Agents: only public agent profiles that render
  (match whatever `agents/[slug]` treats as viewable). Press: published posts.
- Must not touch dashboard query paths (dashboard speed is a hard priority).

### B. Canonical tags
- Every indexable public page declares a self-referencing canonical on `https://cncrealtygroup.com` (no `www`,
  no query string). `/properties?query=…&filters` canonicalises to `/properties`.
- Listing pages → `/properties/{mlsNumber}`; agents → `/agents/{slug}`; press posts → `/press/{slug}`.

### C. Titles and descriptions (head only)
- Root template becomes `"%s | CnC Realty"`; page titles drop their own brand suffix so it appears once.
  Homepage title (default) e.g. "CnC Realty | California Real Estate Brokerage" — **exact wording list to be
  approved by Ryan before build** (see Open questions).
- Add server metadata for `/contact` and `/home-value` via a sibling `layout.tsx` (pages stay client).
- `/properties` description → California (not Southern California). `/manage` → see Open questions.
- Default Open Graph/Twitter card for pages without one (title, description, image). Image choice → Open
  questions.

### D. Main headings (invisible)
- Pages whose hero text is SVG get one visually hidden `<h1>` (Tailwind `sr-only`) with a descriptive heading,
  e.g. Buy "Buy a Home in California with CnC Realty", Join "Join CnC Realty — 100% Commission Real Estate
  Brokerage in California". Add it once in the shared `VideoMaskHero` via an optional prop (Buy/Sell/Rent/Manage/
  Press use it), and in `JoinHero`. The visible SVG stays `aria-hidden` or equivalent so screen readers don't
  read the heading twice. **Exact h1 wording list approved by Ryan before build.**
- Listing page: make the address the `<h1>` and the price a non-heading element with identical classes
  (pixel-identical; Tailwind preflight resets heading styles). Agent page: agent name becomes the `<h1>`.
  `/properties`: hidden h1 "Homes for Sale in California". Homepage keeps its existing h1.
- Exactly one h1 per page.

### E. Business details for Google (JSON-LD, `lib/json-ld.ts`)
- `localBusinessJsonLd`: name "CnC Realty", legalName "CnC Realty", full PostalAddress from the
  footer, email, `areaServed` California, `sameAs` the three social URLs (Google Business Profile URL to be
  added once verified), a logo that is visible on white (not `logo-white.png`), DRE license number
  (e.g. `identifier`/description). **No phone yet** — the Google Voice number will be added later (same number
  must then go on the profile and site).
- Emit it site-wide (root layout) rather than homepage only, plus a `WebSite` object.
- `agentJsonLd.worksFor.name` → "CnC Realty". Keep `jsonLdScriptSafe` for every embed.
- Add `BreadcrumbList` on listing pages (Home › Properties › address) if cheap.

### F. Search page listings in HTML (`/properties`) — conditional
- Goal: the 20 server-fetched cards (with `<a href="/properties/{mls}">`) are in the initial HTML.
- Find what triggers the client-side bailout (likely `useSearchParams` or a `dynamic(..., { ssr:false })` under
  the single Suspense) and isolate it in its own boundary. Watch the `phoneAtLoad` `useState` initializer that
  reads `window` (server/client mismatch on phones).
- **This one can change what a visitor sees during the first moments of load** (cards painted by the server
  instead of after the browser builds them). Final settled layout must be pixel-identical on desktop and phones,
  and speed must not regress; if either fails, drop item F (the sitemap already gives Google every listing).
  Ryan to confirm he accepts "cards may appear sooner" (Open questions).

### G. Join stats readable (shared `ScrambleValue`)
- The real value must be in the server HTML while the visible scramble animation is unchanged, e.g. render the
  real value in an `sr-only` element and the animated text `aria-hidden`. Because `ScrambleValue` is shared
  (FeaturedListings, home-value EstimatedValueRange/LocalMarketSnapshot, Join StatsBar), all users must stay
  pixel-identical; if the DOM change risks layout, scope it via an opt-in prop.

### H. IndexNow (Bing/Yandex instant updates)
- Key file served at the site root (key from an env var), and a fire-and-forget ping after the 15-minute IDX
  delta sync (`/api/idx/sync`) with changed/new/removed listing URLs (≤10,000 per request). Failures are logged,
  never break the sync. New env var must be added in Vercel before deploy (flag at push time).

## Verification (definition of done)
- Unit tests for sitemap content/splitting, canonical/metadata helpers, JSON-LD shape, IndexNow payload.
- Full test suite + `tsc` + `next build` pass.
- Pixel A/B: all public pages incl. listing, agent, press post, contact, home-value — desktop sizes and phones
  identical (item F judged on settled state, see above).
- Speed: before/after on desktop and phone; first-load JS per route not up beyond noise.
- Head check on the new build: one canonical, one h1, single brand in title, valid JSON-LD (no "Los Angeles"),
  sitemap index + child files parse and stay under limits.
- After deploy (Ryan, with guidance): GSC sitemap status + request indexing for main pages; Bing "URLs
  discovered" check.

## Left to the builder
File/module layout, exact sitemap chunk size, caching values, how the hidden-h1 prop is named, test structure,
IndexNow key format, BreadcrumbList inclusion.

## Calls made by Claude (after builder check — Ryan to check while reading)
- **Street address in JSON-LD: include it.** The full Santa Ana address is already printed in the footer on every
  page, so the business details only repeat what visitors already see. The Google Business Profile hides the
  address because the office isn't staffed (a Maps rule); that does not forbid it on the website.
- **Name and legal name are both "CnC Realty"** (Ryan, 2026-10-19: the S-Corp is "CnC Realty", no "Inc";
  "CnC Realty Group" is only the domain). No "CnC Realty Group" anywhere in business data or titles.
- **Hidden h1 wording stays close to the visible hero words** (brand + the hero's own meaning), not a
  keyword-packed rewrite — hidden text that says much more than the screen can read as keyword stuffing. Titles
  (browser tab / Google result) carry the keywords instead. Draft list goes to Ryan for approval (Open question 1).

## Ryan's answers (2026-10-19)
1. **Sold / off-market listing pages:** approved as recommended. `/properties/[mlsNumber]` serves any of ~4M rows
   (mostly Closed). Active listings (`ACTIVE_STATUSES`) stay indexable; any other status keeps working for visitors
   but gets `robots: noindex` and drops the `offers` price from its JSON-LD. IndexNow pings listings that leave
   active status too.
2. **Titles and hidden headings:** approved exactly as below. Root template becomes `"%s | CnC Realty"`; the
   homepage and Contact set their full title directly (no template suffix).

   | Page | Title | Hidden h1 |
   |---|---|---|
   | Home | CnC Realty \| California Real Estate Brokerage | keeps existing h1 |
   | Buy | Buy a Home in California \| CnC Realty | Buy a Home With CnC Realty |
   | Sell | Sell Your Home in California \| CnC Realty | Sell Your Home With CnC Realty |
   | Rent | Homes for Rent in California \| CnC Realty | Rent With CnC Realty |
   | Manage | Property Management \| CnC Realty | Property Management With CnC Realty |
   | Join | Join CnC Realty \| 100% Commission Brokerage in California | Be CnC – Join CnC Realty |
   | Press | Press \| CnC Realty | CnC Realty Press |
   | Home Value | What's My Home Worth? Free Home Value Estimate \| CnC Realty | keeps existing h1 |
   | Contact | Contact CnC Realty | keeps existing h1 |
   | Search | Homes for Sale in California \| CnC Realty | Homes for Sale in California |
   | Listing | {address}, {city}, CA {zip} \| CnC Realty | visible address becomes the h1 |
   | Agent | {name} \| CnC Realty | visible agent name becomes the h1 |
   | Press post | {post title} \| CnC Realty | keeps existing h1 |
3. **Property management is Southern California only.** `/manage` keeps "Southern California" in its description;
   every other page says California. (The business JSON-LD stays `areaServed: California` — the brokerage as a whole
   is statewide.)
4. **Link-preview image:** Ryan's custom image (darker background, white CnC Realty logo over a showing photo),
   source `C:\Users\hey_r\Downloads\Screenshot 2026-10-19 172258.png`, 1885×867, 1.5 MB PNG. Builder: centre-crop
   to 1.91:1 (~115px off each side; the logo spans roughly x 520–1370, so it stays whole), resize to 1200×630, save
   as an optimised JPEG (~150 KB target) in `public/`, and use it as the default Open Graph + Twitter
   (`summary_large_image`) image for every page without its own (listings keep their listing photo). Show Ryan the
   final cropped file before wiring it in.
5. **Item F approved with a hard condition:** only if desktop AND phone load no slower than today (measured,
   before/after). If either is slower, or phones flicker/jump on load, drop item F.
