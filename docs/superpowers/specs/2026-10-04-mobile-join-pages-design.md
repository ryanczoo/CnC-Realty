# Mobile Layout — Sub-project 4 (Join, Application Form, "You're IN", ICA)

**Date:** 2026-10-04
**Status:** Draft for review
**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` — all site-wide rules apply
(desktop never edited; phone layout below 1024px; fluid 320–1023px; sideways phones; `svh`/`dvh`;
CSS first, `useIsMobile()` only for motion; hover → tap; simplified effects). Techniques from
sub-projects 2–3 apply (`max-lg:!…` overrides of inline styles; `max-lg:portrait:`/`landscape:`;
pure functions pinned by unit tests where desktop numbers flow through new code).

## Problem (measured 2026-10-04, local production build)

- `/join` lays out **757px wide at 390px** (961px at 844×390). Overflowing sections: AgentPlan
  ("For Agents, By Agents" + fixed 420px pricing card with `mr-24`), JoinSteps (Transaction
  Management stepper), HowToJoin. The hero ("Be CnC") is drawn on a 1920×1080 `slice` canvas and is
  cropped on upright phones (same issue the shared heroes had).
- `/join/apply/submitted` ("You're IN"): its heading is shifted `-ml-40`, overflowing at every
  phone size.
- `/join/apply` (ApplicationForm): no overflow, but fixed `grid-cols-2`/`grid-cols-3` field rows
  (e.g. City / State / ZIP) are cramped on phones.
- `/join/ica`: no overflow; no change.

## Shared components checked

Reused (no new components):
- **`phoneWordLayout`** (exported by `components/ui/VideoMaskHero.tsx`) — the Join hero's phone
  lettering layer uses it unchanged, with the same phone letter size/gap as the other heroes.
- **`useScrollStepper`** (JoinSteps) — unchanged; the phone layout only rearranges where its text
  panel sits.
- **`MOBILE_QUERY`** (exported by `hooks/useIsMobile.ts`) — the confetti reads it directly at mount
  (see 7) so the site has one phone cutoff.
- **`applyChromaKeyAlpha`** (`lib/chroma-key-alpha.ts`) — unchanged.

No change needed: `FounderQuote` (shared `useScrollWordLight`), `StatsBar` (`flex-wrap`),
`JoinCTAButtons`, `CTALineArt` (shared, contained), `PageCTA` (done in sub-project 1), `/join/ica`.

## Section treatments

### 1. Join hero — `components/join/JoinHero.tsx`
- Desktop SVG gets `max-lg:portrait:hidden` only. A phone SVG (`hidden max-lg:portrait:block`,
  1080×1920 `slice`) renders "Be / CnC" via `phoneWordLayout(["Be", "CnC"])`, centred, same size
  as the other phone heroes, same word fade-in (`wordContainer(0.56)`, `WORD_VARIANT`), own mask id.
- Section height: `max-lg:h-[95svh]`. Sideways phones keep the desktop lettering.

### 2. "For Agents, By Agents" pricing — `components/join/AgentPlan.tsx`
- Stacks: heading (offset `-ml-[4rem]` removed on phones, sizes scaled), city photo (full width),
  then the Pro pricing card full width (`max-lg:w-full`, `max-lg:mr-0`, lighter padding). Sticky
  heading becomes static on phones.

### 3. Stacked cards — `components/join/WhyCnCStacked.tsx`
- Card height (52vh), offsets and the stacking motion are unchanged (the JS slide distance is
  derived from 52vh, so heights stay identical).
- Upright phones: each card's inline `row`/`row-reverse` is overridden to a column
  (`max-lg:portrait:!flex-col`) — photo on top (~40%), text below; heading/body sizes scale.
- Sideways phones: side-by-side kept; text sizes capped by screen height.

### 4. JoinSteps (Transaction Management / Personal Webpage / Custom CRM) — `components/join/JoinSteps.tsx`
- **Simplified effect, upright phones:** the sticky text panel moves above the photos
  (`max-lg:portrait:order-first`, full width, pinned under the navbar with a background), photos
  scroll beneath it at ~40svh each; the active step's text still changes with scroll via the
  unchanged `useScrollStepper`. The vertical progress bar is hidden on upright phones.
- Sideways phones: side-by-side kept; text sizes capped by screen height.
- Image `sizes` already `(max-width: 1024px) 100vw, 55vw` — unchanged.

### 5. How to Join CnC — `components/join/HowToJoin.tsx`
- One column: heading (offsets `-ml-16`/`pl-[5.5rem]`/`ml-[1.5rem]` reduced), steps, then the photo
  (full width, shorter). Sticky behaviour off on phones.

### 6. Application form — `components/join/ApplicationForm.tsx`
- `grid-cols-2` and `grid-cols-3` field rows become one column **below 640px only**
  (`max-sm:grid-cols-1`). Deliberate exception to the 1024px cutoff: two-column field rows fit an
  upright iPad comfortably; only phones are cramped. Nothing else in the form changes.

### 7. "You're IN" page — `app/(marketing)/join/apply/submitted/page.tsx` + confetti
- Heading: `-ml-40` and `ml-[3rem]` offsets removed on phones, sizes scaled; body list fits.
- **Confetti (Ryan's choice A):** on phones/upright iPads the chroma-key runs on a half-resolution
  canvas (640×360, 4× fewer pixels per frame) for smooth playback on slower phone processors;
  desktop keeps 1280×720 exactly. Size chosen by an exported pure function
  `confettiCanvasSize(isMobile)` (desktop numbers pinned by a unit test), with `isMobile` read at
  mount via `window.matchMedia(MOBILE_QUERY)` — the hook's value is still `false` during hydration,
  and the canvas is sized once. Accepted trade-off: small confetti pieces look slightly duller at
  their edges on phones only.

## Load-speed requirements

- No new libraries, components, images, videos or requests.
- Each page's first-load JS within ~2% of baseline (desktop 1440×900 and phone 390×844); total
  transfer compared with hero-video streaming noise excluded.
- No new eager images; any image whose phone box grows gets a `(max-width: 1023px) and
  (orientation: portrait)` size hint so desktop and sideways phones keep their original sizes.
- Confetti CPU cost per frame on phones reduced 4× (above).

## Verification

As sub-project 3: desktop baselines (transforms neutralised) for every changed section, compared
after each task; phone checks at 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390
**plus short sideways heights (844×340, 667×320) to emulate Safari's address bar**; check the
states a person passes through (scroll start/middle/end of the stacked cards and JoinSteps; each
step's text visible while its photo is on screen); form fields usable at 320; unit tests for
`confettiCanvasSize`; full suite, `tsc`, clean build; WEIGHT before/after. Ryan checks live.

## Out of scope

Property search/listings (5), agent profiles / Press / contact / login / legal (6), dashboard (7);
any desktop change; the deferred minors from sub-project 3.
