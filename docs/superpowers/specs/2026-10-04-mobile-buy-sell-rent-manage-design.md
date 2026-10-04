# Mobile Layout — Sub-project 3 (Buy, Sell, Rent, Manage)

**Date:** 2026-10-04
**Status:** Draft for review
**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` — all site-wide rules apply
(desktop never edited; phone layout below 1024px; fluid 320–1023px; sideways phones; `svh`/`dvh`;
CSS first, `useIsMobile()` only for motion; hover → tap; simplified effects). Techniques from
sub-project 2 apply: `max-lg:!…` important overrides of inline styles, and pure functions fed by a
`useIsMobile()` motion value when animation numbers must differ on phones.

**Already done in sub-project 1:** the heroes, FAQ, PageCTA, footer and contact pop-up on these pages.

## No change needed (verified by reading the code; re-checked in the final phone sweep)

- Buy — `BuyFeatures` ("One stop SHOP": `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`),
  `BuySearchListings` ("Search Here"; shared `ListingsMarquee` and search box).
- Sell — `SellQuote` ("Our Promise", `sm:`/`lg:` text sizes), `HomeValueTeaser` ("Sell Smarter",
  `grid-cols-1 sm:grid-cols-2`).
- Manage — `ManageQuote`, `ManageHandle` ("Our Services", `grid-cols-1 md:grid-cols-2`, `md:` sizes).

## Section treatments

### 1. Buy steps — `components/buy/BuySteps.tsx`
- The centre timeline line moves to the left edge on phones (`max-lg:left-4`).
- Each step row stacks to the right of the line: photo, then text (image always first on phones,
  regardless of the desktop left/right alternation); text left-aligned; the `w-16` centre spacer
  and the `pr-12`/`pl-12` gutters collapse.
- The line keeps its scroll-driven segment fill; step numbers and entrance animations unchanged.

### 2. Buy "Why Choose CnC → RESULTS" — `components/buy/BuyContemporary.tsx`
- **Simplified effect:** a second set of corner/cluster positions for upright phones
  (`max-lg:portrait`), laid out two-by-two around "WHY CHOOSE CnC" (images taller than wide, as on
  desktop), flying into the "RESULTS" cluster with the same timeline.
- Positions: CSS overrides for the static corner boxes (`max-lg:portrait:!…`), and the fly-in
  transform math reads a phone constant set selected by `useIsMobile()` + orientation through a
  motion value; desktop constants and their numbers are unchanged and pinned by a unit test.
- Scroll length shorter on phones (≈300svh instead of 400vh).
- The connector lines (an SVG drawn for a 1440×900 canvas) are hidden on phones.
- Headline/body/watermark text sizes scale to fit. Sideways phones keep the desktop positions
  (a wide screen), with text sizes capped by screen height.

### 3. Sell "Our Process" — `components/sell/SellProcess.tsx` (Ryan's choice: swipeable cards)
- Below 1024px the section stops pinning (`max-lg:!h-auto`, sticky → static) and the panel strip
  becomes a horizontally scrollable row with scroll-snap (`max-lg:overflow-x-auto
  max-lg:snap-x max-lg:snap-mandatory`), its scroll-driven `x` transform neutralised
  (`max-lg:!transform-none`).
- Each panel ~85vw wide (`max-lg:!w-[85vw]`, `snap-start`, `shrink-0`), a fixed phone height
  (`max-lg:h-[75svh]`), text sizes scaled; the overlapping two-photo "slide" panels scale their
  `vw`-based boxes to the 85vw card.
- The scroll-driven progress bar is hidden on phones (the swipe row is its own indicator).
- The "Start" button and contact pop-up keep working.

### 4. Sell "Our Values" — `components/sell/SellValues.tsx`
- Phone card math already exists (sub-project 1). Scroll length becomes ≈300svh on phones
  (`max-lg:!h-[300svh]`), sticky panel `max-lg:h-[100svh]`, title sized to fit.

### 5. Rent "Moving made, Easy" — `components/rent/RentSteps.tsx`
- Two columns stack: title (no longer sticky on phones) above the step list; the fixed
  `pl-[7.5rem]` / `ml-[7.5rem]` indents shrink to a scaled indent; the list's `basis-[57%]` becomes
  full width; step title sizes scale. This fixes the only measured horizontal overflow on these
  pages (Rent at 390px laid out 585px wide).

### 6. Rent "Popular Cities" — `components/rent/RentCitiesSlider.tsx`
- Card width ~84vw on upright phones (`max-lg:portrait:!w-[84vw]`) with the 16:9 padding box
  following it; city label sizes scale (`clamp`); the ±55vw prev/next offsets stay (clipped by the
  section's `overflow-hidden`); auto-rotation and arrows unchanged.

## Shared components and patterns reused

- **Swipe row pattern** — `components/agents/StatCards.tsx` already implements a phone swipe row:
  row `overflow-x-auto [scroll-snap-type:x_mandatory]` with `style={{ scrollbarWidth: "none" }}`,
  children `flex-shrink-0 [scroll-snap-align:start]`. "Our Process" uses exactly this pattern (as
  `max-lg:` classes) rather than any new carousel component or library. No carousel library is
  installed and none is added.
- **`useIsMobile()`** (sub-project 1) — reused for the Buy photo-cluster positions.
- No new shared components.

## Load-speed requirements (mobile)

Baseline measured 2026-10-04 (phone 390×844, local production build): Buy downloads ~3.9MB on first
load — a 1.8MB `GoogleSansFlex.woff2` font (site-wide, pre-existing), ~1.4MB hero video, ~400KB JS,
~200KB images. Live server response times are fine (Buy 0.42s, Sell/Rent/Manage ~0.3s); the local
10s figure is local-only (database over a home connection, no CDN cache).

1. **No added downloads.** The phone work adds no new libraries, components, images, videos or
   network requests — only CSS classes and small pure functions. Each page's first-load JS and total
   transfer at 390×844 must stay within ~2% of its baseline.
2. **Right-sized images.** Where a phone box becomes larger than its desktop `sizes` hint (Sell
   process photos sized `18.8vw`/`14.8vw`/`93vw`, Rent city cards `65vw`, Buy cluster photos
   `18–25vw`), the `sizes` attribute gains a phone condition first, e.g.
   `sizes="(max-width: 1023px) 85vw, 18.8vw"`. Desktop still matches the original value, so it
   downloads exactly the same image; phones get a sharp image instead of an upscaled small one,
   without fetching desktop-sized files.
3. **No eager loading added.** Below-the-fold images keep Next's default lazy loading; nothing on
   these pages gains `priority` on phones.

Out of scope here but reported to Ryan as separate load-speed opportunities (pre-existing, site-wide):
the 1.8MB font file (could be subset to Latin and the weights in use) and the hero videos on phones.

## Verification

As in sub-projects 1–2: desktop baseline (transforms neutralised) captured before changes and
compared after each task; phone checks at 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180,
844×390 — no element past the screen edge (clipped content excluded), text not cut off, interactive
elements reachable (swipe row scrolls, buttons tappable); unit tests for extracted pure logic; full
suite, `tsc`, clean build. Checks must cover the states a person passes through (scroll start,
middle, end; each card in the swipe row), not just one position — the gap that let the sub-project 1
footer bug and sub-project 2 flip bug through. Ryan checks everything live after the final push.

## Out of scope

Join/application pages (4), property search and listings (5), agent profiles / Press / contact /
login / legal (6), dashboard (7); any desktop change.
