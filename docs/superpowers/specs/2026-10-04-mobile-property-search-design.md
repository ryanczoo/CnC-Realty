# Mobile Layout — Sub-project 5: Property Search, Listing Details, Home-Value Report

**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (rules: phone layout below
1024px, desktop never changes, fluid 320–1023px, sideways phones incl. short Safari heights, no new
libraries, load speed not worse).
**Scope added by Ryan (2026-10-04):** the home-value report page (`/home-value`) joins this
sub-project — it was not assigned to any of the original 7.
**Reference:** eXp Realty's phone search (list first, one card per row, floating "Show Map" pill) and
listing sheet (full-screen, swipeable photos, sticky contact bar) — screenshots shared by Ryan.

## Hard constraints

- **Desktop (≥1024px) is pixel-identical.** Only `max-lg:` / `max-lg:portrait:` / `max-lg:landscape:` /
  `max-sm:` classes (incl. `!` overrides of inline styles), phone-only JS paths whose desktop result is
  pinned by unit tests, and phone-only elements hidden on desktop (`lg:hidden`) that request nothing on
  desktop.
- **Desktop map timing:** the one desktop-side behaviour change (map mounts one effect tick after the
  page renders — see §1) must show **no noticeable delay**. Measured before/after; if the desktop map
  appears noticeably later, the map-deferral is dropped and phones load the map as today.
- **No new libraries, no new requests on desktop.** Phone-only photo strips must not download images on
  desktop (all strip images `loading="lazy"` inside a `display:none` container).

## Shared pieces — reuse first

Checked before designing:

| Need | Reused | New |
|---|---|---|
| Phone/desktop switch | `useIsMobile` / `MOBILE_QUERY` (sub-project 1) | — |
| Swipe row | StatCards / SellProcess pattern: `overflow-x-auto [scroll-snap-type:x_mandatory]`, hidden scrollbar, children `flex-shrink-0 [scroll-snap-align:start]` | — |
| Save heart | `components/properties/SaveButton.tsx` (already on the full listing page) | — |
| Contact form | `components/properties/ContactForm.tsx` (gains an optional `id` prop only) | — |
| Filter pills + menus | `FilterBar.tsx` itself, phone classes only | — |
| Bottom section | `PageCTA` (phone-ready since sub-project 1) | — |
| Phone photo strip | — | **`PhotoSwiper`** — used by both the popup and the full listing page |
| Sticky contact bar | — | **`StickyContactBar`** — used by both the popup and the full listing page |

No shared slide-up sheet exists; the filter menus become bottom sheets with classes on their existing
markup instead of a new component (Ryan chose this — "option A").

## 1. Property search page (`/properties`) — `SearchResults.tsx`, `FilterBar.tsx`, `PropertyCard.tsx`, `loading.tsx`

**Top bar (phones):**
- First row: the "For Sale / For Rent" pill + the search box (search box grows to fill the row).
- Second row: Price, Beds, Baths, Type, Clear pills and the "N homes" count in **one swipeable row**
  (the swipe-row pattern). Implemented with a wrapper that is `display:contents` on desktop (no box, so
  desktop layout is untouched) and the swipe row on phones.
- **Pill menus become bottom sheets on phones:** each existing dropdown gets phone classes — fixed to
  the bottom edge, full width, rounded top corners, larger tap targets, safe-area bottom padding. The
  bar's `backdrop-blur` is removed on phones (`max-lg:backdrop-blur-none`) because a blurred parent
  would trap a `fixed` child inside the bar. The existing tap-outside backdrop closes the sheet.

**Results (phones):**
- List only, **1 card per row below 640px** (every upright phone, `max-sm:grid-cols-1`); **2 per row from 640–1023px** (sideways phones, iPads) — the existing `grid-cols-2`.
- List pane is full width; the map pane is hidden.
- Card image `sizes` gains a portrait-phone entry
  (`(max-width: 639px) 100vw, …existing`) — desktop entries unchanged.
- Infinite scroll, spinner, error and empty messages unchanged.

**"Show Map" pill (phones):**
- Floating dark pill, bottom center (site's standard pill + pulse). Tap → map fills the screen below the
  filter bar; pill reads **"Show List"**. Pins open the listing popup exactly as on desktop.
- **The page opens on the list** (like eXp).
- **Speed:** phones download the map code (~1.7 MB, the site's largest file) only on the **first** "Show
  Map" tap; it then stays mounted (hidden behind the list) so switching back is instant.
- Mechanism: the map pane renders only once the page has mounted and decided phone vs desktop —
  `shouldRenderMap(mounted, isMobile, mapRequested)` (pure, exported, tested): desktop
  `(true,false,*) → true` (pinned), phones only after a tap. Desktop therefore mounts the map one effect
  tick after first render (the map already shows a grey placeholder until its code arrives, so nothing
  looks different) — measured, per the hard constraint.

**Loading skeleton (phones):** single column, map placeholder hidden.

## 2. Listing popup (`PropertyDrawer.tsx`) — phones

- **Full screen** below the navbar (`max-lg:!w-full` over the inline `min(880px, 63vw)`).
- Top bar ("Back to search", "Open full page ↗") unchanged.
- **Photos:** `PhotoSwiper` replaces the single photo + arrows on phones — full-width swipe strip,
  counter ("3 / 29") and status badge kept; prev/next arrows kept (they scroll the strip). Desktop keeps
  the existing photo + arrows (`max-lg:hidden` / `lg:hidden` split).
- **Heart on the photo is hidden on phones** — it moves into the sticky bar (desktop keeps it on the
  photo).
- Stats row (3 across): smaller text on phones so values fit at 320px.
- Detail lists: 2 columns → 1 on small phones (`max-sm:grid-cols-1`).
- Contact form + mortgage calculator: already stacked below at narrow widths — unchanged; the stacked
  contact form gets `id` for the bar to scroll to.
- **`StickyContactBar`** at the bottom of the popup (phones only, `lg:hidden`):
  - Frosted off-white: `#F2F0EF` at ~80% with a backdrop blur.
  - **Heart (`SaveButton`) on the left, "Contact Agent" dark pill (pulse) on the right.**
  - "Contact Agent" scrolls the popup to its contact form.
  - Popup content gets bottom padding so the bar never covers the last lines.

## 3. Full listing page (`/properties/[mlsNumber]`) — page + `PhotoGallery.tsx` — phones

- Dark "Back to search" strip unchanged.
- **Photos:** the 5-photo grid is hidden on phones; `PhotoSwiper` shows instead (one full-width photo,
  swipe, counter). Tapping a photo opens the existing full-screen viewer (already works on phones).
- Price row: status badge drops **below** the price on phones; the heart beside the badge is hidden on
  phones (it lives in the sticky bar).
- Stats row: smaller text on phones. Detail lists 2 → 1 column on small phones.
- **Two columns → one:** the sticky right column (contact form + mortgage calculator) moves **below**
  the details, full width, not sticky.
- **`StickyContactBar`** (same as the popup): heart left, "Contact Agent" right → scrolls to the contact
  form. Page bottom padding added on phones so the footer/disclaimer is never covered.
- CRMLS disclaimer unchanged.

## 4. Home-value report (`/home-value`) — page + `components/home-value/*` — phones

Already partly responsive (photo + estimate stack via `md:`; comparable sales `grid-cols-1 sm:2 lg:3`).
- Page side padding reduced on phones; title sized to fit.
- Estimate card: less padding; its 3-across stats get smaller text to fit at 320px.
- Local Market Stats chart: tighter bar gaps and smaller labels so every bar fits.
- Price History, Comparable Sales (incl. page arrows), manual-entry form: no change.
- "Reveal my estimate" popup: less padding; its 2-field rows → 1 per row on small phones (`max-sm:`).
- "You're In Control" bottom section: shared `PageCTA`, no change.
- **Testing note:** the report needs the database; Ryan's office network blocks it, so this page is
  checked from home (or with a known address).

## Verification

- **Desktop:** element boxes at 1440×900 identical before/after for: filter bar + list pane, the open
  popup, the full listing page, the home-value report. Desktop request list for the popup and the full
  listing page shows **no extra image requests**.
- **Desktop map timing:** time from page load to the map canvas appearing, before vs after (several
  runs). No noticeable change, or the deferral is dropped.
- **Phones** (320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390, 844×340, 667×320): no
  sideways scroll; filter row swipes; each pill's sheet opens at the bottom and closes; list 1 per row
  (2 sideways and on iPads); Show Map / Show List toggle; map code requested **only** after the first tap; popup full
  screen, photos swipe, counter updates, sticky bar heart toggles save and "Contact Agent" reaches the
  form; full page stacked with the bar; home-value fits at 320 with the reveal form 1 field per row.
- **Load:** first-load JS per page within ~2%; phone `/properties` total download **smaller** (no map
  code until tapped).
- **Tests:** unit tests for `shouldRenderMap` (desktop pinned) and the `PhotoSwiper` index-from-scroll
  helper; full suite, `tsc`, clean production build per task.

## Out of scope

- Desktop anything. Map provider changes. Server-side phone detection (rejected: complex, iPads report
  as desktop). New filter options. Changing what the popup/full page show — layout only.
