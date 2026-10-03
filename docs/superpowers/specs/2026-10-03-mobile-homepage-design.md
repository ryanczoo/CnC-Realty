# Mobile Layout — Sub-project 2 (Homepage)

**Date:** 2026-10-03
**Status:** Draft for review
**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` — all site-wide rules apply
(desktop never edited, phone layout below 1024px, fluid 320–1023px, short sideways screens,
`svh`/`dvh`, CSS first / `useIsMobile()` only for motion, hover → tap, simplified effects).

## Technique addition

Inline styles cannot change per screen size. Instead of moving them (sub-project 1's FAQ approach),
this sub-project may override them on phones with Tailwind's important modifier, e.g.
`max-lg:!static max-lg:!w-full`. A `!important` stylesheet rule beats a non-important inline
style, and because the variant is `max-lg:`, it never applies at ≥1024px — so the desktop code is
not touched at all. Either technique is allowed; prefer the important modifier when the inline
style is computed from data.

## Shared components checked (no change needed)

- **`PlaceholdersAndVanishInput`** (hero search; also Buy page) — its 800px canvas sits inside an
  `overflow-hidden` container, so it never widens the page. Earlier overflow scans flagged it
  because they ignored clipping. Left untouched.
- **`ListingsMarquee`** (homepage + Buy page) — card row already fits; left untouched.
- **`useScrollStepper`** (Why CnC, Join, Rent) — left untouched; Why CnC keeps its vertical bar.
- **`useIsMobile()`** (from sub-project 1) — reused for motion values below.
- **FAQ** — already done in sub-project 1.

No new shared components.

## Section treatments

### 1. Hero — `components/home/HeroSection.tsx`
- Top offset `mt-72` gets a phone override so the phrase and search sit near the vertical centre
  (`max-lg:mt-24`).
- Section height: `min-h-screen` gets `max-lg:min-h-[100svh]`.
- Phrase animation and search unchanged.

### 2. Exclusive Listings — `components/home/FeaturedListings.tsx`
- The heading's fixed staggers (`-ml-[1.6in]` / `ml-[1.6in]`) get phone overrides that scale with
  the screen (`max-lg:-ml-[18vw]` / `max-lg:ml-[18vw]`), keeping the staggered look without
  running off the edge. Heading sizes scale with `clamp()` on phones.
- `ListingsMarquee` unchanged.

### 3. Why CnC — `components/home/WhyCnC.tsx`
- **Simplified effect:** still pinned, still switching panels on scroll. Below 1024px the panel
  stacks: media block (back video + overlapping front photo) on top (~45% of the screen height),
  title + description + button below.
- **Scroll length:** section height becomes ~2 screens on phones instead of 4
  (`max-lg:!h-[200svh]` overriding the inline `${ITEMS.length * 100}vh`); the sticky panel uses
  `max-lg:h-[100svh]`. `useScrollStepper` works off scroll progress, so it needs no change.
- **Progress bar:** stays vertical, repositioned beside the text block on phones.
- **Titles:** scale with `clamp()` on phones so "COMMISSION" fits at 320px.
- Media positions (inline `%` styles) get `max-lg:!` overrides for the stacked layout.

### 4. Services — `components/home/ServicesSection.tsx`
- **Simplified effect, one card per row (Ryan's choice):** heading first, then the four cards
  full-width in a single column (`max-lg:!static` etc. overriding the absolute collage positions).
- **Parallax:** kept but reduced on phones (`useIsMobile()` scales the per-card `parallax`
  distances, e.g. to 15%) so cards never drift into each other.
- **Flip:** tap still flips (existing click handler).
- **Custom "VIEW" cursor:** hidden on phones (`max-lg:hidden`); no hover on touch.
- Section `minHeight: "108vh"` gets a phone override to auto height.

### 5. "We create trust" + Advantage carousel — `TestimonialsIntro.tsx`, `AdvantageCarousel.tsx`
- Sticky headline and cover-up effect kept; `top-[32vh]` / `mt-[52vh]` get `svh` phone
  equivalents.
- Carousel cards widen on phones to ~90vw and use a taller aspect ratio so title + subtitle are
  not cramped; arrows stay below and clear the stacked back cards.

### 6. Testimonial cards — `components/home/TestimonialCards.tsx`
- Below 1024px the three columns stack into one column in reading order; the side columns' 200px
  top offsets are removed; each box's fixed 420px height becomes auto (photo boxes keep a fixed
  aspect so they still show), so no quote is cut off.

### 7. Join CnC image expand — `components/home/JoinCnCCTA.tsx`
- **Simplified effect:** the image starts larger on phones (~80% width) and grows to full width
  over ~1.5 screens instead of 2 (`max-lg:!h-[150svh]`); the "Be CnC / Join Now" overlay timing is
  unchanged relative to scroll progress. Start width and heights come from `useIsMobile()` (motion
  values); heights use `svh`.

## Verification

Same as sub-project 1: desktop baseline captured before any change and compared after each task
(transforms neutralized); phone checks at 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180,
844×390 — no element past the screen edge (clipped content excluded), text not cut off, sections
reachable; unit tests for any extracted pure logic; full suite, `tsc`, clean build per task. Ryan
checks everything live after the final push.

## Out of scope

Other pages (sub-projects 3–6), the dashboard (7), any desktop change.
