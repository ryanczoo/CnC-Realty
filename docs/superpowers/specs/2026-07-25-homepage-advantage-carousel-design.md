# Homepage "Advantage" Stacked-Card Carousel — Design Spec

**Date:** 2026-07-25
**Status:** Approved by Ryan (2026-07-25) — ready for implementation plan

---

## Why this exists

Ryan wants a new homepage section modeled on Compass's `/sell` page "Compass Advantage" carousel — a 3-card stacked-depth slider highlighting CnC's differentiators (Academy, CRM, Transaction Management). Read via Puppeteer directly against `compass.com/sell` to confirm the actual mechanic rather than guess from the screenshot alone (see Research below).

---

## Placement

Sits on the homepage between Services and the testimonial review cards — specifically, it becomes the content that scrolls up and **covers** the existing sticky "We create..." headline (Testimonials' approved Mino-style cover-reveal effect), replacing that role currently held by the 3-column review cards. The review cards become their own plain section immediately after, no longer part of the cover mechanic.

```
<ServicesSection />
<TestimonialsHeadline />      ← sticky "We create..." (unchanged visually/logic)
<AdvantageCarousel />         ← NEW — this is what covers the headline now
<TestimonialCards />          ← extracted from Testimonials.tsx, plain section, no cover effect
<GradientBridge ... />
<FAQ ... />
```

`Testimonials.tsx` is split into two components (`TestimonialsHeadline` keeps the sticky/ghost-word logic exactly as-is; `TestimonialCards` keeps the 3-column review grid exactly as-is, just loses the `mt-[52vh]`/cover-specific offset since `AdvantageCarousel` now owns that role). No visual/behavioral change to either piece's own internals — only the DOM position of what comes between them.

---

## Research: how Compass actually builds this

Inspected `compass.com/sell`'s live DOM/computed styles via Puppeteer (not guessed from the screenshot):

- **3 cards, same box, absolutely positioned**, each holding one of 3 fixed depth slots via `transform: translate(x, y)`:
  - **Front** (active): offset ~‑7% width / ‑10.5% height (up-left), highest z-index, fully visible, sharp
  - **Middle**: no offset, sits directly behind, peeking bottom-right
  - **Back**: offset ~+7%/+10.5% (down-right), lowest z-index, peeking the least
- Clicking an arrow **reassigns which card occupies which slot** — it doesn't slide cards sideways. Each card springs to its new slot with a physics-based overshoot-then-settle (~550ms total).
- Card box ratio ≈ 1.45:1, `border-radius: 22px`, drop shadow offset down-right.
- Title top-left over the image, body copy directly below the title, both over a dark scrim for legibility.
- No auto-play — arrows only.

This is the same "position-pool" pattern already used in this codebase's `RentCitiesSlider` (`getSlideState`/`slideAnimate`, prev/active/next), just 3 depth slots instead of 3 horizontal slots. `AdvantageCarousel` reimplements the mechanic in Framer Motion using this codebase's own conventions — it does not copy Compass's code or styling (font, colors, exact copy) beyond the layout/animation pattern itself.

---

## What ships

### New component: `apps/web/src/components/home/AdvantageCarousel.tsx`

- 3 fixed slides, each: `{ title: string; subtitle: string; image: string }`
- Slide data:

  | Slide | Title | Subtitle | Image |
  |---|---|---|---|
  | 1 | CnC Academy | Learning center and training guides in one place | `/images/sell/sell-11.jpg` (placeholder) |
  | 2 | Full CRM | Free client relationship management system built with AI | `/images/advantage-crm.jpg` (real — Ryan-provided screenshot, already copied in) |
  | 3 | Transaction Management System | Our in-house TMS helps you save money and remain compliant | `/images/sell/sell-12.jpg` (placeholder) |

- **Stack mechanic**: 3 cards in fixed depth slots (front/middle/back), matching Compass's offset ratios (~7%/10.5% of card width/height, opposite directions, decreasing z-index back to front). New shared spring constant in `lib/motion.ts`, e.g. `STACK_SPRING = { type: "spring", stiffness: 220, damping: 24 }`, tuned to approximate Compass's ~550ms settle — reused here rather than inventing a one-off transition.
- **Card visuals**: `border-radius` and drop-shadow matching Compass's proportions, full-bleed image, dark gradient scrim (same `bg-gradient-to-t from-black/70 via-black/20 to-transparent` pattern already used on `FeaturedListings` cards) for text legibility.
- **Card text**: title in `font-sans`, larger than the subtitle beneath it (per Ryan's explicit sizing instruction), both left-aligned, positioned upper-left over the image — title/subtitle size relationship modeled on how `WhyCnC`'s card overlay text is already scaled in this codebase.
- **Arrows**: reuse `RentCitiesSlider`'s `ArrowIcon` SVG and circular pill-button treatment verbatim (rotated ±90°, `PULSE_ANIMATE` + `PULSE_TRANSITION` idle pulse, `SPRING_HOVER` on hover) — visually identical to the Popular Cities arrows Ryan pointed to.
- **No auto-play** — manual arrow navigation only, matching Compass.
- Section background: `bg-[#F2F0EF]`, `data-navbar-theme="light"` (same off-white as the surrounding Services/Testimonials sections — no new bridge needed).

### Modified: `apps/web/src/components/home/Testimonials.tsx`

Split into:
- `TestimonialsHeadline` — the sticky "We create..." block, logic/markup unchanged, just extracted so it can render as its own piece in `page.tsx`
- `TestimonialCards` — the 3-column review grid, logic/markup unchanged except it drops the `mt-[52vh]` cover-offset (no longer needed — it's a plain section now, not something sliding over a sticky sibling)

### Modified: `apps/web/src/app/page.tsx`

Replace the single `<Testimonials />` with `<TestimonialsHeadline />`, `<AdvantageCarousel />`, `<TestimonialCards />` in that order, in the position shown in Placement above.

### Assets

- `apps/web/public/images/advantage-crm.jpg` — already copied in from Ryan's provided screenshot (108KB)
- Placeholders reuse existing unused stock photos already in the repo (`sell-11.jpg`, `sell-12.jpg`) — no new files needed for those; swappable later by just changing the `image` path in the slide data array.

---

## What is explicitly NOT touched

- The sticky "We create..." headline's own animation/logic — extracted verbatim, not modified.
- The 3-column review cards' own content, images, or fade-up stagger — extracted verbatim, not modified.
- `RentCitiesSlider.tsx` itself — arrow icon/button styling is copied, not imported as a shared dependency (it's a small enough SVG + button pattern that duplicating it here matches how it's already duplicated in a couple of other slider components in this codebase, rather than introducing a new shared-arrow abstraction for two call sites).
- No new database queries, no server component needed — this is fully static content, client-rendered like `RentCitiesSlider`.

---

## Open items for the implementation plan

- Exact card box size in `rem`/`vw` at desktop and how it degrades on mobile (Compass's numbers were captured at 1440px viewport — needs a responsive pass, likely similar treatment to `RentCitiesSlider`'s `65vw`/`maxWidth` pattern).
- Whether `STACK_SPRING`'s exact stiffness/damping needs tuning once seen live — the spec's values are a starting estimate from the sampled Compass transform data, not pixel-matched.
