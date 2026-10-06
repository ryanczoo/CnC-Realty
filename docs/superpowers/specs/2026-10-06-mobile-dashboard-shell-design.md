# Mobile Layout — Sub-project 7a: Dashboard Shell + Shared Pieces

**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px,
desktop never changes, fluid 320–1023px incl. sideways phones with short Safari heights, no new
libraries, load speed not worse).
**Date:** 2026-10-06 · **Status:** Draft for Ryan's review

## Sub-project 7 breakdown (agreed with Ryan 2026-10-06)

The dashboard is too large for one spec (31 pages, ~90 files, ~12,400 lines, zero phone code). Every
area gets the same careful phone design; transactions and campaigns are what agents will use most on
phones. Each piece gets its own spec → plan → build:

| | Scope |
|---|---|
| **7a** (this spec) | Shell (sidebar → slim bar + slide-in menu, page frame) and shared pieces every page uses: popups/drawers, form-field size, tables, tab bars, touch drag |
| 7b | Transactions: file list, file detail (tabs, checklist, uploads, parties), New Transaction + New Listing wizards |
| 7c | Campaigns (list, new-campaign wizard + drip editor, stats), Academy, Settings, and the client `/account` page (moved from sub-project 6) |
| 7d | Overview, Leads (board, smart lists, lead profile), Pipeline, Tasks — board phone layouts |
| 7e | Admin pages (15) |

**Data note:** the CRM is empty (0 leads, campaigns, files, deals, tasks, applications). Detail pages are
surveyed in 7b–7e; creating sample records in the shared production database needs Ryan's OK first.

## Survey (local production build of `cc8a0c6`, logged in as admin, read-only, 2026-10-06)

| Screen | Content width left by the sidebar | Pages scrolling sideways |
|---|---|---|
| 320×568 | 96px | 26 / 26 (worst: New Transaction, 457px) |
| 390×844 | 166px | 19 / 26 |
| 844×390, 820×1180 | 620px / 596px | 0 / 26 (sidebar still takes 224px) |

- **Sidebar** (`app/(dashboard)/layout.tsx`): fixed `w-56` column on every page.
- **Shell simulated in the browser only** (sidebar hidden, 16px padding): 17 of 26 pages fit at 390 and
  320. The other 9 are page-specific (wizard step bars, a tab bar, pill rows, tags table, Leads board) →
  7b–7e.
- **Coupled to the shell:** Leads (`-m-8`, `min-h-[calc(100vh-4rem)]`) and New Campaign
  (`min-h-[calc(100vh-4rem)]`).
- **Popups/drawers (14):** 6 side drawers are full width on phones and scroll inside (fine). Smart List
  drawer is fixed `w-96` (384px). Of 7 centered popups, 6 cannot scroll and 4 have no edge margin — on a
  sideways phone a tall popup's Save button is unreachable.
- **Form fields:** 47 of 71 visible fields are 14px → iPhone Safari zooms the page on every tap.
- **Tables (13):** 12 have no sideways-scroll box; `AdminTable` clips columns (`overflow-hidden`).
- **Tab bars:** the pill bar `flex gap-1 rounded-xl bg-[#F2F0EF] p-1` is copied in 5 places; Pipeline's
  is 374px wide.
- **Drag boards:** `LeadKanban` and `DealBoard` repeat the same `PointerSensor` (distance 8) setup —
  touch drags fight page scrolling.

## Hard constraints

1. **Desktop (≥1024px) is pixel-identical.** Existing class strings are never edited — only phone words
   are added, every one prefixed `max-lg:` (compiles to `@media not all and (min-width:1024px)`).
   Desktop element boxes of all 26 dashboard pages must match the pre-change fingerprints.
2. **Width-based switch at 1024px** (Ryan, option A): a laptop window narrower than 1024px gets the
   phone layout — same as the public site, eXp, Compass.
3. No new libraries. Reuse first: `NavSection` and nav lists from `layout.tsx`, the site navbar's
   `AnimatePresence` + backdrop pattern, `useIsMobile()`, `@dnd-kit`'s built-in touch sensor.
4. Load speed not worse on desktop or phone (measured before/after).

## Design

### 1. Shell

- **Desktop sidebar unchanged;** hidden below 1024px (`max-lg:hidden` added).
- **Nav lists move to `lib/dashboard-nav.ts`** (`AGENT_NAV`, `ACADEMY_NAV`, `ADMIN_NAV`, `SETTINGS_ITEM`)
  and **`NavSection` to `components/dashboard/NavSection.tsx`** — moved as-is (identical output), so the
  desktop sidebar and phone menu render from one source. `NavSection` gains an optional `activeHref`
  (phone only; when omitted the output is identical to today).
- **Slim bar** (phones only, ~44px, white, sidebar's border): ☰ button on the left, current page name
  beside it. Name comes from `dashboardPageTitle(pathname, isAdmin)` — exact match on the nav lists,
  else the longest matching prefix (e.g. a lead detail page → "Leads"). Pure function, unit-tested.
- **Slide-in menu:** new client component `components/dashboard/DashboardMobileNav.tsx` (`lg:hidden`)
  holds the open state the server layout can't. Panel slides in from the left **over** the page (never
  pushes it): `w-[280px] max-w-[85vw]`, full height, white, scrolls inside, dimmed backdrop. Same
  sections as the desktop sidebar (Agent, CnC Academy, Account/Admin, email footer); current page
  highlighted. Closes on link tap, backdrop tap, ✕, Escape, and route change.
- **Page frame on phones:** outer frame stacks (`max-lg:flex-col`) with height `max-lg:h-[100svh]`;
  slim bar sits above `<main>`, which stays the scroll container. `<main>` padding `max-lg:p-4`
  (desktop `p-8`).
- **Coupled pages:** Leads adds `max-lg:-m-4`; Leads and New Campaign add
  `max-lg:min-h-[calc(100svh-4rem-2.75rem)]` (navbar + slim bar).

### 2. Shared phone styling bundle — `lib/dashboard-phone.ts`

Named phone-only class strings (same precedent as `NAV_PANEL_CLS`/`NAV_ITEM_CLS` in `lib/motion.ts`),
appended to existing classes. `tailwind.config.ts` already scans `src/lib/**`.

- `PHONE_POPUP_FRAME` — edge margin on the centered overlay (`max-lg:p-4`).
- `PHONE_POPUP_PANEL` — panel height capped to the screen and scrolls (`max-lg:max-h-[calc(100svh-2rem)]
  max-lg:overflow-y-auto`).
- `PHONE_DRAWER_PANEL` — full width (`max-lg:w-full`), for the Smart List drawer.
- `PHONE_TABLE` — table scrolls sideways inside its own box, no new wrapper element
  (`max-lg:block max-lg:overflow-x-auto`).
- `PHONE_TAB_BAR` — tab bar scrolls sideways within itself, pills keep their size
  (`max-lg:max-w-full max-lg:overflow-x-auto max-lg:[&>*]:shrink-0`).
- `PHONE_FIELDS_16` — 16px text for fields (see 3).
- `PHONE_DRAG_CARD` — no iPhone text-selection popup on draggable cards
  (`max-lg:select-none max-lg:[-webkit-touch-callout:none]`).

**Safety test:** every whitespace-separated word in every export must start with `max-lg:` — a desktop
rule can never enter the bundle.

**Popups — centered on phones (Ryan):** NewLeadModal, NewDealModal, AssignLeadModal, RelationshipSection,
AdminLeadsClient, AdminLeadsMergeClient, and LeadTasksTab's popup (today a bottom sheet below 640px —
made centered on phones for consistency) get `PHONE_POPUP_FRAME` + `PHONE_POPUP_PANEL`. SmartListDrawer
gets `PHONE_DRAWER_PANEL`. The 6 other drawers need nothing.

### 3. Form fields — no iPhone zoom

The dashboard's outer frame in `layout.tsx` gets `PHONE_FIELDS_16`:
`max-lg:[&_input]:text-base max-lg:[&_select]:text-base max-lg:[&_textarea]:text-base
max-lg:[&_[contenteditable=true]]:text-base`. Covers popups (they render inside the frame — confirm in
the build). Desktop fields stay 14px. Rejected: `maximum-scale=1` (blocks pinch-zoom), editing 47+ fields.

### 4. Tables

`PHONE_TABLE` on the 12 `<table>`s that have no sideways-scroll box (the 13th already sits inside one and
is left alone). `AdminTable`'s wrapper `overflow-hidden` also gets `max-lg:overflow-x-auto`. Card layouts
for specific tables are decided page by page in 7b–7e.

### 5. Tab bars

`PHONE_TAB_BAR` on the 5 pill bars (Pipeline, Transactions, admin Transactions, admin file detail, lead
profile tabs). The agent file-detail tabs are checked in the build and get it too if they overflow.

### 6. Touch drag — `hooks/useBoardSensors.ts`

Replaces the duplicated sensor setup in `LeadKanban` and `DealBoard`:
- **Desktop:** exactly today's `PointerSensor` with `{ distance: 8 }`.
- **Phones** (`useIsMobile()`): `TouchSensor` `{ delay: 400, tolerance: 8 }` (0.4s hold, Ryan) +
  `MouseSensor` `{ distance: 8 }`. Auto-scroll near edges is `@dnd-kit`'s default (left on).
- Config chosen by a pure `boardSensorConfig(isMobile)` (unit-tested); hooks always call `useSensor` the
  same way. Cards get `PHONE_DRAG_CARD`. Board layouts themselves → 7d.

## Verification

1. **Tests:** `dashboardPageTitle`, `boardSensorConfig`, the bundle safety test (red → green). Full suite,
   `tsc`, clean build after every task.
2. **Desktop:** element-box fingerprints of all 26 dashboard pages at 1440×900 and 1024×768, before and
   after, twice each — identical. Desktop field font 14px, sidebar visible, slim bar absent.
3. **Phones** (320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390, 844×340, 667×320): no
   sideways page scroll from the shell on any of the 26 pages; content width = viewport − 32px; menu
   opens/closes (link, backdrop, ✕, Escape, route change) and scrolls on 844×340; page names correct;
   fields 16px incl. inside an open popup; popups fit with margin and reach Save at 844×340; tables and
   tab bars scroll inside themselves; touch drag via synthetic touch events (0.4s hold picks up, quick
   swipe scrolls); Ryan confirms on his iPhone.
4. **Speed:** desktop + phone (DPR 3) for `/dashboard`, `/dashboard/transactions`, `/dashboard/leads` —
   JS/CSS bytes, load, LCP, fresh profiles, before vs after. CSS growth reported in bytes.

## Out of scope

Page-specific phone layouts (7b–7e), board column layouts (7d), `/account` (7c), sample data, pushing
to GitHub / deploying (Ryan's call).
