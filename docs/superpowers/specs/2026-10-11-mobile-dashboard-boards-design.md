# Mobile Layout — Sub-project 7d: Overview, Leads, Pipeline, Tasks (the boards)

**Parent specs:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px,
desktop never changes, fluid 320–1023px incl. sideways phones, no new libraries, load speed not worse),
`2026-10-06-mobile-dashboard-shell-design.md` (7a: shell, `lib/dashboard-phone.ts` bundles,
`hooks/useBoardSensors.ts` long-press drag), `2026-10-07-…transactions-design.md` (7b: stacked headers),
`2026-10-10-…campaigns-academy-account-design.md` (7c).
**Date:** 2026-10-11 · **Status:** Draft for Ryan's review

## Scope

| Page / piece | File(s) |
|---|---|
| Overview + My Stats (agent) | `app/(dashboard)/dashboard/page.tsx`, `components/dashboard/DashboardTabs.tsx` |
| Leads page frame + Smart Lists menu | `app/(dashboard)/dashboard/leads/page.tsx`, `components/leads/SmartListSidebar.tsx` |
| Leads board | `components/dashboard/LeadKanban.tsx` |
| Smart List results | `components/leads/SmartListResults.tsx` |
| Lead profile + tabs, task drawer, new-lead / relationship / smart-list popups | `app/(dashboard)/dashboard/leads/[id]/page.tsx`, `components/leads/*` |
| Pipeline + deal drawer + New Deal popup (lead search) | `app/(dashboard)/dashboard/pipeline/page.tsx`, `components/deals/*` |
| Tasks | `app/(dashboard)/dashboard/tasks/page.tsx` |

**Sample data (Ryan's OK, 2026-10-10/11), created directly in the database so no email or automation fires**
(script `packages/database/_samples7d.mjs`, IDs in `.superpowers/7d-survey/sample-ids.json`): 8 fake leads
(`zz-sample-lead1..8@example.com`) across the board's columns, 6 links to existing tags, 2 notes, 1
relationship, 4 deals (Buyers: Pre-Approval / Touring / Offer Submitted; Sellers: Active Listing), 5 tasks
(overdue, due today, upcoming ×2, done), and a temporary agent login `zz-sample-agent@example.com` that owns
leads 5–8 with their deals and tasks. All deleted at the end of 7d with a zero-leftovers check.

## Survey (production build of `52ac1f6`, 2026-10-10/11)

Measured as admin and as the agent at 320×568, 390×844, 844×390, 820×1180 (inner dashboard `<main>`), plus
screenshots. The numbers showed no page-level overflow (7a's in-frame scrolling contains it); the problems are
visible only in screenshots:

| Problem | Where | Size |
|---|---|---|
| Smart Lists sidebar keeps a fixed 200px column; the board / results table get the remaining ~150–190px (cards cut off, table names one word per line) | Leads page, every list | 320–820 |
| Custom Smart List edit (✎) / delete (✕) only appear on mouse hover — unreachable on touch | Leads page | all phones |
| Board columns stay 224px wide; one card visible and cut off | Leads board | 320–390 |
| Deal cards keep a fixed 224px width inside full-width stage rows | Pipeline | 320–1023 |
| Drawer sits one layer below the site's top bar, hiding its title and × close button | Deal drawer | **all sizes, desktop too** |
| Task titles cut off with "…" | Tasks page, lead's Tasks tab | 320–1023 |
| Four quick-task buttons squeeze into one row; labels wrap | Lead's Tasks tab | 320–390 |

Already fine on phones: Overview, My Stats (range pills wrap to two rows), lead profile cards and tabs,
New Deal popup + lead search, New Lead popup, pipeline type tabs (7a swipe row).

## Hard constraints

1. **Desktop (≥1024px) is pixel-identical — with one approved exception:** the Deal drawer's layer moves
   from `z-40` to `z-50` (Ryan, 2026-10-11) so its title and × show on desktop too, matching every other
   dashboard drawer. Everything else: existing class strings are only appended to, with phone-only words
   (`max-lg:`, `max-sm:`, `sm:max-lg:`).
2. Reuse first: `lib/dashboard-phone.ts` bundles (`PHONE_TAB_BAR`, `PHONE_HEADER_STACK`, `PHONE_TABLE_FRAME`,
   …). One new bundle only, because the same fix is needed in two places: `PHONE_WRAP_TEXT` (task titles on
   the Tasks page and the lead Tasks tab). No new component, no new library.
3. Drag-and-drop (`hooks/useBoardSensors.ts`, 7a) is not changed: 0.4s hold on phones, desktop unchanged.
4. Load speed not worse on desktop or phone (measured before/after). Nothing pushed until 7e is complete.

## Design

### 1. Leads page — Smart Lists become a swipeable pill row (Ryan's choice)

- `leads/page.tsx` frame `-m-8 flex …` gains `max-lg:flex-col`; the content column `flex-1 overflow-auto p-8`
  gains `max-lg:min-w-0 max-lg:p-4` so the board/table get the full width.
- `SmartListSidebar` root (`flex w-[200px] flex-shrink-0 flex-col border-r … px-3 py-6`) gains, below 1024px:
  full width, row direction, bottom border instead of right border, `px-4 py-3`, `PHONE_TAB_BAR` (sideways
  scroll within itself), and every button `shrink-0 whitespace-nowrap`.
- The two section wrappers (`mt-4`) become `max-lg:contents` so their pills sit in the same row; their
  "SMART LISTS" / "MY LISTS" headings are `max-lg:hidden`.
- Custom-list pills: the hover-only ✎ / ✕ group (`absolute right-1 hidden group-hover:flex`) becomes
  `max-lg:static max-lg:flex` (always visible beside the name); the name's `pr-14` becomes `max-lg:pr-3`.
- "+ New List" (`mt-4 w-full`) becomes `max-lg:mt-0 max-lg:w-auto` — the last pill in the row.
- Order matches desktop: Kanban · built-in lists (Newsletter for admins) · custom lists · + New List.

### 2. Leads board — swipe columns (Ryan's choice)

- `LeadKanban` columns container (`flex gap-4 overflow-x-auto pb-4`) gains `max-lg:snap-x
  max-lg:snap-proximity`; each column (`flex w-56 flex-shrink-0 …`) gains `max-sm:w-[85%] sm:max-lg:w-[45%]
  max-lg:snap-start` — one column plus a peek on phones, two columns on upright iPads.
  (`snap-proximity`, not `mandatory`, so dnd-kit's edge auto-scroll during a drag isn't fought by snapping.)
- "+ Add Lead" row (`mb-4 flex justify-end`) gains `max-lg:[&>*]:w-full` (full-width button under the heading).

### 3. Smart List results

- Header row (`mb-6 flex items-center justify-between`) gains `PHONE_HEADER_STACK` + `max-lg:gap-1`.
- The table (already inside `PHONE_TABLE_FRAME`) gains `max-lg:whitespace-nowrap`, so it scrolls sideways in
  its card instead of squeezing names to one word per line (same approach as 7b's parties table).

### 4. Pipeline

- Header row (`mb-6 flex items-center justify-between`) gains `PHONE_HEADER_STACK` + `max-lg:gap-3` (the
  "+ New Deal" button stretches full width under the heading).
- `DealBoard` drop zone (`flex w-56 min-h-[120px] …`) gains `max-lg:w-full`.

### 5. Deal drawer (all sizes — approved desktop change)

- Outer wrapper `fixed inset-0 z-40` → `fixed inset-0 z-50`. Nothing else changes; the Save/Delete footer
  stays pinned at the bottom.

### 6. Tasks — titles wrap (Ryan's choice) and quick buttons

- New bundle `PHONE_WRAP_TEXT = "max-lg:whitespace-normal max-lg:[overflow-wrap:anywhere]"` appended to the
  title `<p className="truncate …">` in the Tasks page's `TaskRow` and in `LeadTasksTab`'s `TaskRow`; both
  rows gain `max-lg:items-start` so the checkbox and date align with the first line.
- `LeadTasksTab` quick-button row (`flex gap-2`) gains `max-lg:grid max-lg:grid-cols-2`; "+ New Task"'s
  `ml-auto` gains `max-lg:ml-0`.

### 7. No change

Overview, My Stats, lead profile cards/tabs, New Deal popup + lead search, New Lead popup, pipeline type tabs,
drag sensors.

## Verification

- **Desktop fingerprint:** before the first change, element boxes of every 7d view × 1440×900 and 1024×768,
  as admin and as the agent: Overview, My Stats, Leads board, 2 Smart Lists, Smart List drawer, lead profile ×
  4 tabs, lead task drawer, New Lead popup, Pipeline × 2 types, deal drawer, New Deal popup, Tasks. Re-run
  after every task; any difference stops the work — except the deal drawer, whose boxes don't change (only
  its layer does); it gets a desktop screenshot showing the title and × now visible.
- **Phones:** the same views at 320×568, 390×844, 844×390, 820×1180, admin and agent — nothing sideways,
  nothing cut off, fields 16px, custom-list ✎/✕ reachable, every button reachable. Screenshots checked every
  time, not only the numbers.
- **Real phone (Ryan drives):** the production build served on this computer's Wi-Fi address
  (`next start -H 0.0.0.0`; Windows may ask once to allow it through the firewall). Logged in as the
  temporary agent: long-press (0.4s) a lead card and drag it to another column, including toward the screen
  edge to reach the next column; a quick swipe scrolls instead of picking up; long-press a deal and move it to
  another stage; no text-selection popup. Claude checks the result after each step. Done after the desktop
  fingerprints are final (moving cards changes the sample data).
- **Speed:** interleaved fresh-profile runs of the pre-7d build vs the new build — Overview, Leads, Pipeline,
  Tasks; desktop and phone.
- **Tests:** dashboard-phone prefix test extended to the new `PHONE_WRAP_TEXT` export (still phone-only
  words); full suite + `tsc --noEmit` + clean production build after every task.
- **Cleanup:** `_samples7d.mjs delete` (leads, deals, tasks, tag links, notes, relationship, temporary
  agent), confirm zero rows; delete the script.

## Out of scope

Desktop changes other than the deal drawer layer, new features, the 13 other admin pages (7e), the public
footer appearing below the dashboard (same on desktop, already approved), the agent-only brokerage-leads
banner layout (no pending brokerage leads in the samples; it is a full-width card and will be re-checked in 7e
with the admin lead pages).
