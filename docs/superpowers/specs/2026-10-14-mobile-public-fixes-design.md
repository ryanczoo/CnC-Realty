# Mobile Public-Page Fixes (from Ryan's phone walkthrough, 2026-10-13)

**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px, desktop
never changes, fluid 320–1023px incl. sideways phones, no new libraries, load speed not worse).
**Date:** 2026-10-14 · **Status:** Design approved by Ryan 2026-10-14 (spec awaiting review)

## Scope

Six issues Ryan found walking the live site on his iPhone after the 2026-10-13 push. All are phone/tablet-only
(below 1024px). Paths under `apps/web/src/`.

| # | Page / section | File(s) |
|---|---|---|
| 1 | Homepage — Why CnC | `components/home/WhyCnC.tsx` |
| 2 | Footer (every public page) | `components/layout/Footer.tsx` |
| 3 | Buy — "One stop SHOP" | `components/buy/BuyFeatures.tsx` |
| 4 | Sell — Our Process | `components/sell/SellProcess.tsx` |
| 5 | Contact pop-up (Buy, Sell, Rent, Manage, Join, Home Value, Join → submitted) | `components/ui/ContactModal.tsx` |
| 6 | Join — "For Agents, By Agents" and the four feature titles | `components/join/AgentPlan.tsx`, `components/join/JoinSteps.tsx` |

## Hard constraints

1. **Desktop (≥1024px) is pixel-identical** (Ryan verified it at deploy). Changes are only phone-only class words
   (`max-lg:`, `max-sm:`, `max-lg:portrait:`) appended to existing class strings, plus — for #4 only — JavaScript
   values chosen by the shared `useIsMobile()` hook, whose desktop branch returns exactly today's values.
2. **Reuse first:** `hooks/useIsMobile.ts` (the site's single phone cutoff, same as `max-lg:`), the existing
   desktop scroll mechanism in `SellProcess`, and the indent value `HowToJoin` already uses on phones
   (`max-lg:pl-[3rem]`). No new component, hook, library or shared file.
3. Load speed not worse on desktop or phone (measured against the current live build). Ryan approves any push.

## Design

### 1. Homepage — Why CnC

Phone portrait today: photos on top (`max-lg:portrait:flex-col-reverse`), progress bar centred in the text panel
(`top-1/2 -translate-y-1/2`), small front photo centred 10% lower than the video.

- Text first, photos below: `max-lg:portrait:flex-col-reverse` → `max-lg:portrait:flex-col` (the text panel is
  already the first child). The text panel's `max-lg:portrait:pt-6` stays; the photo area keeps its 45% height.
- Progress bar level with the title/text: on phone portrait the bar is pinned to the top of the text block instead of
  the panel's middle — add `max-lg:portrait:top-6 max-lg:portrait:translate-y-0` (keeps `max-lg:left-6`,
  `max-lg:!h-[120px]`). It starts at the title's first line and runs down beside the text.
- Small photo centred on the video like desktop: video box is `top 10%, height 82%` (centre 51%); front photo moves
  from `max-lg:portrait:!top-[30%]` to `max-lg:portrait:!top-[20%]` (height 62% → centre 51%). Applied to **both**
  the real front image and its invisible preload copy (they must stay the same box so the preloaded file matches).
- Sideways phones (landscape) unchanged — they already use the side-by-side desktop arrangement.

### 2. Footer — page links on top, logo at the bottom (Ryan's option B)

Phone stack today: logo → contact block (email, address, newsletter, icons) → page links. New order: **page links →
contact block (same internal order) → logo**, then the legal bar as today. Done with flex `order` on the three
children of the stacked row: links `max-lg:order-1`, contact block `max-lg:order-2`, logo `max-lg:order-3`. No DOM
change, so desktop's left-to-right layout and the scroll-reveal are untouched.

### 3. Buy — "One stop SHOP"

Where the items stack in **one column (below 640px)**: no left border line, and every item centred.
- Each feature item and the CTA item gain `max-sm:border-l-0 max-sm:items-center max-sm:text-center`.
- The icon centres via `items-center`; the CTA's inner `flex flex-col` gains `max-sm:items-center` so "Explore" and
  the "All Listings" button centre too.
- 640–1023px (sideways phones, iPads) keep today's two-column layout with its dividing lines — there the line
  separates columns, as on desktop.

### 4. Sell — Our Process uses desktop's pinned scroll on phones (Ryan's option A)

Today phones switch the desktop mechanism off (`max-lg:!h-auto`, `max-lg:static`, `max-lg:!transform-none`, an
`overflow-x-auto` snap row) and hide the progress bar. New phone behaviour = desktop's:

- **Pinned section:** the sticky container stays sticky on phones (`max-lg:static`/`max-lg:h-auto`/
  `max-lg:overflow-visible` removed from it; phone height `max-lg:h-[100svh]` so Safari's toolbar can't hide the
  bottom). The sideways-swipe classes on the row are removed (`overflow-x-auto`, snap, `!transform-none`, `!w-auto`);
  the panels keep their phone widths (`max-lg:!w-[85vw]`) and gap.
- **Scroll drives the slide:** the row's `x` keeps desktop's value (`0vw → -TRAVEL_VW vw`) when `useIsMobile()` is
  false. When true, `x` = `-(progress × travelPx)`, where `travelPx` = the row's measured width minus the viewport
  width (measured after mount and on resize with a `ResizeObserver`).
- **Section height on phones** = `travelPx + one screen height`, so each swipe moves the cards about one-for-one
  (set as a CSS variable read by a `max-lg:` height class; desktop keeps its inline `900vh`). Before the first
  measurement, phones use a safe fallback of `600svh`.
- **Progress bar on phones:** shown (drop `max-lg:hidden`), inset `max-lg:left-6 max-lg:right-6`; its four segments
  keep desktop's `scrollYProgress` ranges. The "Our Process" title returns to desktop's absolute position with
  phone insets (`max-lg:left-6`), and the row sits below it (phone row height `max-lg:h-[75svh]`, top offset so the
  title and bar are clear of it; sideways phones keep `max-lg:landscape:h-[85svh]`).
- Every step is seen: scrolling down walks through all four steps before the page continues; scrolling up walks
  back. The page is not "locked" — a fast flick passes through the steps quickly, but each passes on screen.
- The "Start" button and its contact pop-up work as today.

### 5. Contact pop-up fits under the navbar

Today: centred on the full screen (`items-center`), `max-lg:max-h-[90dvh]`, Message box `rows={4}`; the 64px navbar
(`fixed top-0 z-50`) covers the top of the pop-up and the Send button falls off the bottom.

- Phone frame: `max-lg:items-start max-lg:pt-20 max-lg:pb-4` (pop-up starts 16px below the 64px navbar).
- Phone panel: `max-lg:max-h-[calc(100dvh-6rem)]` (keeps `max-lg:overflow-y-auto`), so it never runs under the
  navbar or past the bottom; on the smallest phones it scrolls inside itself.
- Message box on phones: `max-lg:h-16` (~2 lines) — a textarea already scrolls inside itself when the text is
  longer; it stays `resize-none`.
- Tighter spacing on phones: form `gap-6` → `max-lg:gap-4`; subtitle `mb-8` → `max-lg:mb-5`.
- Target: the whole form, including Send and the consent line, visible without scrolling at 390×664 (an iPhone's
  visible area with Safari's bars); at 320×568 the pop-up scrolls inside itself and nothing is cut off.

### 6. Join — staggered titles keep their indent on phones

The phone indent `HowToJoin` already uses for "Join CnC" is `max-lg:pl-[3rem]`; the same value is used here so the
three headings line up.
- `AgentPlan`: the "By Agents" line gains `max-lg:pl-[3rem]` ("For Agents," keeps `max-lg:ml-0`).
- `JoinSteps`: the gold second word ("Management", "Software", "Webpage", "Campaigns", and the fifth item's) gains
  `max-lg:portrait:inline-block max-lg:portrait:pl-[3rem]` — portrait only, because portrait is where the title turns
  left-aligned; sideways phones keep their right-aligned desktop look.

## Verification

- **Desktop fingerprint:** before the first change, element boxes + full-page screenshots (photos hidden,
  animations frozen) of `/`, `/buy`, `/sell`, `/join`, `/rent` (footer), and the contact pop-up open on `/buy`, at
  1440×900 and 1024×768. Re-run after every task; any difference stops the work. Scroll-driven sections
  (Why CnC, Our Process) are measured at fixed scroll positions.
- **Phones:** screenshots at 320×568, 390×844, 844×390, 820×1180 of every changed section; no sideways page scroll.
  Pop-up: Send button and consent line on screen at 390×664; at 320×568 everything reachable by scrolling the pop-up.
- **Our Process test:** scroll the section from top to bottom at 390×844 — each of the four step titles appears
  on screen in order, the progress bar's four segments fill in turn, and the page continues to the next section
  only after the last step; scrolling back up reverses it.
- **Speed:** interleaved fresh-profile runs of the current live build vs the new build — `/`, `/buy`, `/sell`,
  `/join` — desktop and phone; JS request counts and timings compared.
- **Tests:** full suite + `tsc --noEmit` + clean production build after every task.
- **Real phone:** Ryan re-checks the six items on his iPhone after the push.

## Out of scope

Desktop changes; other public sections; the font trim (separate item); the dashboard.
