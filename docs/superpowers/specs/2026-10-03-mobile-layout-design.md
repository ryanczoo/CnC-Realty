# Mobile Layout — Site-Wide Rules + Sub-project 1 (Shared Pieces)

**Date:** 2026-10-03
**Status:** Draft for review

## Problem

The site is live at cncrealtygroup.com and looks broken on phones across every public page.
Verified at a 390px phone viewport on the live site: the page lays out **569px wide** — sections
overflow the screen edge (Why CnC's "COMMISSION" heading, the testimonial columns, the footer
columns, the hero search animation, the listings marquee track). Hero lettering is cropped
("SELL / WITH US" renders as "SELL / ITH U").

**Root cause:** the public site was designed and tuned for desktop only. No phone layout was ever
designed. Of the public-page files, very few have any `sm:`/`md:` breakpoint; the breakpoints that
exist are almost all `lg:`/`xl:` (enlarging for big screens), and none collapse a layout for phones.
The listings, agent-profile and auth pages have no breakpoints at all. Several layouts are
hardcoded in inline styles (e.g. the FAQ's `gridTemplateColumns: "26% 52% 22%"`), which cannot
respond to screen size. The dashboard has the same pattern (fixed 224px sidebar, 6 of 49 files with
phone breakpoints).

## Goal

The public site — and later the dashboard — looks intentional on phones and upright iPads. Scroll
animations keep **simplified versions of the same effects** on phones, not plain stacking.

**Success:** every page, checked by Ryan on his iPhone, has no sideways overflow, no cut-off text,
readable sizes, and working (simplified) animations — with the desktop site pixel-identical to
today.

## Site-wide rules (apply to every sub-project)

1. **Desktop is never edited.** Existing classes, inline styles, and animation values stay exactly
   as they are. Phone behavior is only *added*: through Tailwind `max-lg:` variants (apply below
   1024px only), or through the `useIsMobile()` helper for animation values. Where an inline style
   must move so it can be overridden, it becomes an `lg:` arbitrary class with the identical value
   (e.g. `lg:[grid-template-columns:26%_52%_22%]`), so desktop renders the same.
2. **Phone layout applies below 1024px.** Phones in both orientations and upright iPads get the phone
   layout; sideways iPads and computers keep desktop. (Tailwind 3.4.19, default screens — `max-lg:`
   is supported; the site uses none today.)
3. **Fluid from 320px to 1023px.** Phone layouts are never tuned to one device. Percentage/flex
   widths, wrapping text, headlines that scale with the screen (`clamp()`/`vw`), never below a
   readable size. Range covers a folded Galaxy Z Fold (~344px) through an upright iPad (~834px).
4. **Short sideways screens.** Phone versions of full-height and scroll-animation sections must fit
   and function at ~375px viewport height (a sideways phone).
5. **Safari's address bar.** Phone versions use Tailwind's address-bar-aware height units
   (`svh`/`dvh`, e.g. `max-lg:h-[95svh]`) instead of `vh`. Desktop keeps its current `vh` units.
6. **CSS first, JS only for motion.** Layout changes (stacking, sizing, hiding/showing) use CSS, so
   the server-rendered page is already the phone layout on first paint — no flash. `useIsMobile()`
   is used only to swap animation values (scroll distances, transforms) in scroll-animation
   sections.
7. **Above-the-fold animated sections** (the agent profile top section) must render their phone
   layout through CSS on first paint; the helper only adjusts motion afterward.
8. **Hover becomes tap** anywhere hover reveals content (FAQ answers, flip cards, custom cursors).
9. **Simplified-effect pattern** for scroll-animation sections:
   - *Same idea, less distance* — keep the effect's character, shorten the scroll it takes (Why
     CnC's 4 panels: ~4 screens on desktop → ~2 on phones).
   - *Same direction as the phone* — sideways-scrolling sections (Sell "Our Process") become
     swipeable sideways cards rather than hijacking ~9 screens of vertical scroll.
   - *One column* — side-by-side panels stack; the animation plays on the stacked version.
   - *Never overflow* — nothing wider than the screen.

## Sub-project order

Each sub-project gets its own spec → plan → build. Later sub-projects reuse everything built
before them; each later spec lists its pages' sections with the specific phone treatment, approved
by Ryan before any code.

1. **Shared pieces** (this spec, below)
2. Homepage
3. Buy, Sell, Rent, Manage
4. Join, application form, "You're IN" page
5. Property search + listing details
6. Agent profiles, Press, contact, login, legal pages
7. Dashboard

## Sub-project 1: Shared pieces

### 1. `useIsMobile()` — new helper

- **File:** `apps/web/src/hooks/useIsMobile.ts` (alongside the existing `useScrollStepper.ts`).
  No existing shared screen-size helper exists (checked: only one-off reads in `SellValues.tsx` and
  `BuyContemporary.tsx`, and a reduced-motion check in `ConfettiCannonInner.tsx`).
- **Behavior:** returns `true` when `(max-width: 1023px)` matches; updates on resize/rotation via a
  `matchMedia` change listener. Returns `false` during server render and until mounted in the
  browser, so server HTML always matches desktop and hydration never mismatches.
- **Breakpoint constant:** the query string is exported as a single constant so every consumer
  shares the same 1024px cutoff.
- **Consumer migrated in this sub-project:** `components/sell/SellValues.tsx` replaces its
  render-time `window.innerWidth < 1024` check with the helper. Same cutoff, so desktop is
  unchanged; this also removes a latent server/browser disagreement (the current check runs during
  render, where `window` is undefined on the server).
- **Tests:** unit tests for the helper (initial `false`, reacts to a matching/non-matching media
  query, removes its listener on unmount), using a mocked `window.matchMedia`.

### 2. `VideoMaskHero` (Buy, Sell, Rent, Manage, Press heroes)

- **Problem:** lettering is drawn on a 1920×1080 SVG with `preserveAspectRatio="xMidYMid slice"`;
  on a tall narrow screen the slice crops the sides of the words.
- **Phone treatment:** the existing desktop SVG gets `max-lg:portrait:hidden` (no other change).
  A second SVG with `hidden max-lg:portrait:block` renders a portrait canvas (1080×1920 viewBox)
  with one word per line ("SELL / WITH / US", "PRESS"), sized so the longest word ("MANAGE") fits
  a folded Galaxy Fold. Same video, same mask technique, same word-by-word fade-in
  (`wordContainer`, `WORD_VARIANT`). **Sideways phones keep the desktop lettering** — its wide
  1920×1080 canvas suits a wide, short screen, where the tall phone canvas would be cropped top and
  bottom.
- **Mask ids:** the phone mask uses a distinct id (`${maskId}-mobile`) so the two masks never
  collide.
- **Height:** the section keeps its desktop `heightClass`; phones get the same percentage in `svh`
  via a new optional prop for the phone height (default `max-lg:h-[95svh]`; Press, whose desktop
  height is `h-[47.5vh]`, passes `max-lg:h-[47.5svh]`).
- **Callers:** `BuyHero`, `SellHero`, `RentHero`, `ManageHero`, `PressHero` need no change beyond
  Press's height prop.

### 3. `FAQ` (homepage, Buy, Sell, Rent)

- **Phone treatment:** each row stacks: question with its `( n )` number on one line, answer below.
  Closed answers collapse (`max-lg:hidden` when not open) so stacked rows leave no blank gaps; tap
  opens one at a time, using the existing `openIdx` click/keyboard handling. Answer left padding
  (`pl-24`) is removed on phones.
- **Inline style:** `gridTemplateColumns: "26% 52% 22%"` moves to
  `lg:[grid-template-columns:26%_52%_22%]` — identical desktop value. The existing `grid` class
  stays; the phone grid is defined only with `max-lg:` classes (question and `( n )` number on the
  first row, the answer spanning the full second row).
- **Desktop:** unchanged, including hover reveal.

### 4. `Footer` (every page)

- **Phone treatment:** the three-column row (logo / contact + newsletter + social / page links)
  stacks into one centered column; the logo scales to fit; the legal bar wraps cleanly. The sticky
  clip-path reveal animation is kept.
- **Height:** any phone-specific height uses `svh`.

### 5. `PageCTA` (Buy, Sell, Rent, Manage, Home Value, "You're IN" page)

- **Phone treatment:** when two buttons are present they stack vertically and go full width
  (`max-lg:flex-col`) instead of overflowing side by side. Heading size scales fluidly. The
  `CTALineArt` background decoration is checked and scaled so it does not overflow.

### 6. `ContactModal` (used by PageCTA, Join CTA buttons, Manage, Sell Process)

- **Phone treatment:** lighter padding (`max-lg:p-6` vs `p-10`), and the panel scrolls internally
  (`max-lg:max-h-[90dvh] max-lg:overflow-y-auto`) when the form is taller than the screen.

### 7. No change needed

- **Navbar** — already phone-friendly (menu button + dropdown); it only appeared wide because
  other sections stretched the page.
- **FormField** — already full-width.
- **RevealLine / RevealText** — reveal text inside whatever layout contains them; overflow comes
  from the containing section, which each page's sub-project fixes.

## Verification (every change)

- Unit tests for new logic (the helper; any extracted pure functions).
- **Desktop regression check (internal, Claude only):** each touched component measured in a
  desktop-size browser (≥1280px) before and after — element bounding boxes must match.
- **Phone checks (internal, Claude only):** each touched component viewed at 320, 375, 390, 430,
  an upright iPad (~820), and a sideways phone (~844×390) — no horizontal overflow
  (`document.documentElement.scrollWidth === innerWidth`), no clipped text.
- Full test suite, `tsc --noEmit`, and a clean production build after every change.
- **Ryan checks phone results on his iPhone.** No before/after screenshots are produced for him.

## Out of scope for sub-project 1

- Page-specific sections (Why CnC, testimonials, Buy steps, Sell process, etc.) — sub-projects 2–6.
- The dashboard — sub-project 7.
- Any desktop change of any kind.
