# Mobile Layout — Sub-project 7d (Overview, Leads, Pipeline, Tasks boards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones and upright iPads (<1024px) the Leads page (Smart Lists, board, results), Pipeline, deal drawer and Tasks fit the screen with nothing squeezed or cut off, desktop stays pixel-identical except the approved Deal-drawer layer fix, and long-press drag is proven on a real phone.

**Architecture:** Same method as 7a–7c: phone-only words appended to existing class strings, reusing `lib/dashboard-phone.ts` bundles. One new bundle `PHONE_WRAP_TEXT` (used in two files). One approved all-sizes change: the Deal drawer wrapper `z-40` → `z-50`. Drag sensors (`hooks/useBoardSensors.ts`) untouched.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4.19, @dnd-kit/core, Vitest (node env), Puppeteer for controller checks.

**Spec:** `docs/superpowers/specs/2026-10-11-mobile-dashboard-boards-design.md`

## Global Constraints

- **Desktop (≥1024px) pixel-identical**, except the Deal drawer wrapper `z-40` → `z-50` (Ryan-approved 2026-10-11). Every other change only *appends* `max-lg:` / `max-sm:` words to existing class strings.
- **Reuse first:** `PHONE_TAB_BAR`, `PHONE_HEADER_STACK`, `PHONE_TABLE_FRAME` from `@/lib/dashboard-phone`. The only new bundle is `PHONE_WRAP_TEXT`. No new component, no new library.
- **Leads board columns are one column + a peek on phones AND upright iPads:** `max-lg:w-[85%]` (Ryan, 2026-10-11).
- **No push** (nothing pushed until 7e is complete). Commit per task, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Every task ends with:** `cd apps/web && npx vitest run`, `npx tsc --noEmit`, clean build (`rm -rf apps/web/.next && pnpm --filter web build`). Before deleting `.next`, check `netstat -ano | grep ":3000 .*LISTEN"` — if Ryan's dev server is running, report instead. Stop the controller's own port-3100 server before any build.
- **Sample data** (Ryan-approved): `packages/database/_samples7d.mjs` (`create|agent|lists|count|delete`), IDs in `.superpowers/7d-survey/sample-ids.json`; admin `ryanchong@cncrealtygroup.com` / `Fakeaccount1!`; temporary agent `zz-sample-agent@example.com` / `ZzSampleAgent2026!`. Browser checks never save: every non-GET `/api/*` call except `/api/auth/*` is aborted by request interception, **except** during the real-phone test (Task 6), which deliberately moves sample cards.

## Review Focus

1. **A custom Smart List on a phone** — its ✎ (edit) and × (delete) are visible and tappable without hover; tapping ✎ opens the list drawer. Checked in Task 5 with the sample custom lists.
2. **Long-press drag on a real phone** — 0.4s hold picks up a lead card; dragging toward the screen edge scrolls to the next column (snap must not fight it); a quick swipe scrolls instead of picking up. Task 6 (Ryan drives).
3. **Exactly 1024px** — sidebar column, 224px board columns, one-line task titles, side-by-side headers. Fingerprints at 1024×768 in every task.
4. **A long task title plus a long lead name on a 320px phone** — the title wraps, the date stays on the right, nothing widens the page. Sample task "ZZ Sample: schedule second showing for the Rancho Santa Margarita home" on lead "…O'Connor-Whitfield". Task 2 + Task 5.
5. **Deal drawer on desktop** — title and × now visible above the site's top bar; nothing else on desktop moves. Task 4 desktop screenshot + fingerprint.

## Controller toolkit

Work dir `.superpowers/7d-survey/` (git-ignored). Puppeteer `C:/Users/hey_r/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer`, Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, headless. Under git-bash set `MSYS_NO_PATHCONV=1` before passing `/paths` in env vars.

**SURVEY** (`survey7d.cjs`, exists): all 7d views at 320×568, 390×844, 844×390, 820×1180; `SURVEY_AS=agent` logs in as the temporary agent. Fix before Task 1's baseline: its `lead-tasks/homes/plans` setups must click the tab button inside `main` only (the hidden sidebar "Tasks" link matches first) — change those `clickText(p, "Tasks")` calls to use scope `"main button"`. Add a view `list-custom` = `/dashboard/leads?list=<custom list id>` (from `sample-ids.json` `customListAdmin` / `customListAgent`).

**FINGERPRINT** (`fingerprint7d.cjs`, new — from `.superpowers/7c-survey/fingerprint7c.cjs`): admin and agent contexts; views: overview, (agent) overview-mystats, leads-board, list-new-week, list-hot, list-custom, list-new-drawer, leads-new-modal, lead-activity, lead-tasks, lead-homes, lead-plans, lead-task-drawer, pipeline-buyers, pipeline-sellers, deal-drawer, new-deal-modal, tasks — reuse `survey7d.cjs`'s view setups; at 1440×900 and 1024×768 (DPR 1); root `document.querySelector("aside").parentElement`; 7a MEASURE (transforms neutralized). Plus **PIXEL** full-page shots of `deal-drawer` (admin, both sizes) with `img{visibility:hidden}`. Prints `N/N identical` and `k/k pixel-identical`. Non-GET API calls aborted.

**SPEED** (`.superpowers/mobile-tools/speed-ab.cjs`): `SPEED_PAGES=/dashboard,/dashboard/leads,/dashboard/pipeline,/dashboard/tasks`, admin login.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/dashboard-phone.ts` | modify | + `PHONE_WRAP_TEXT` |
| `apps/web/src/__tests__/lib/dashboard-phone.test.ts` | modify | eleven bundles; wrap bundle content |
| `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx` | modify | task title wraps, row aligns top |
| `apps/web/src/components/leads/LeadTasksTab.tsx` | modify | same + quick buttons 2×2 |
| `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx` | modify | frame stacks, content full width |
| `apps/web/src/components/leads/SmartListSidebar.tsx` | modify | sidebar → swipe pill row, ✎/× always shown |
| `apps/web/src/components/dashboard/LeadKanban.tsx` | modify | 85% snap columns, full-width Add Lead |
| `apps/web/src/components/leads/SmartListResults.tsx` | modify | stacked header, table scrolls |
| `apps/web/src/app/(dashboard)/dashboard/pipeline/page.tsx` | modify | stacked header |
| `apps/web/src/components/deals/DealBoard.tsx` | modify | full-width drop zone |
| `apps/web/src/components/deals/DealDrawer.tsx` | modify | `z-40` → `z-50` (all sizes) |

---

### Task 1: Baselines (controller)

- [ ] `git status -s apps/web/src` empty; `BASE_SHA` = HEAD.
- [ ] **Sample custom lists** — add a `lists` mode to `_samples7d.mjs`: create `SmartList { agentId: <Ryan's agent>, name: "ZZ Sample My Hot Buyers", filters: [{ field: "status", op: "in", value: ["HOT_PROSPECT"] }] }` and `{ agentId: <temp agent>, name: "ZZ Sample Follow-ups With A Long List Name", filters: [] }` (check `lib/smart-list-filters.ts` for the exact filter shape before writing it); save their ids as `customListAdmin` / `customListAgent`. Extend `count` (`smartLists` named `ZZ Sample%`) and `delete` (delete `SmartList` named `ZZ Sample%` before the agent). Run `node _samples7d.mjs lists && node _samples7d.mjs count`.
- [ ] Old-build copy for the speed A/B: `git worktree add <scratchpad>/b7d BASE_SHA`, `pnpm install --frozen-lockfile`, copy `apps/web/.env.local`, `pnpm --filter web build` there.
- [ ] Apply the SURVEY fix; write `fingerprint7d.cjs`. Clean build of BASE in the main checkout if `.next` isn't BASE's; serve 3100. FINGERPRINT twice (`base1`, `base2`) → identical to each other; keep `base1`. If a view is unstable, fix the script (waits, wait for images) first.
- [ ] SURVEY admin (`s-base`) and agent (`a-base`) with screenshots — records the spec's survey table. Stop 3100.

### Task 2: Wrap bundle + Tasks

**Files:** Modify `apps/web/src/lib/dashboard-phone.ts`, `apps/web/src/__tests__/lib/dashboard-phone.test.ts`, `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx`, `apps/web/src/components/leads/LeadTasksTab.tsx`

**Interfaces — Produces:** `PHONE_WRAP_TEXT: string` from `@/lib/dashboard-phone`.

- [ ] **Step 1: Failing test.** In `dashboard-phone.test.ts` change the first test to:

```ts
  it("exports the eleven phone bundles", () => {
    expect(Object.keys(bundle).sort()).toEqual([
      "PHONE_DRAG_CARD", "PHONE_DRAWER_PANEL", "PHONE_FIELDS_16", "PHONE_FIELD_PAIR", "PHONE_HEADER_ACTIONS",
      "PHONE_HEADER_STACK", "PHONE_POPUP_FRAME", "PHONE_POPUP_PANEL", "PHONE_TABLE_FRAME", "PHONE_TAB_BAR",
      "PHONE_WRAP_TEXT",
    ]);
  });
```

and add:

```ts
  it("wrap text lets a truncated line wrap on phones (overrides truncate's nowrap, breaks long words)", () => {
    expect(bundle.PHONE_WRAP_TEXT.split(/\s+/)).toEqual(["max-lg:whitespace-normal", "max-lg:[overflow-wrap:anywhere]"]);
  });
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/dashboard-phone.test.ts` — Expected: FAIL (missing `PHONE_WRAP_TEXT`).
- [ ] **Step 3: Implement.** Append to `apps/web/src/lib/dashboard-phone.ts`:

```ts
// A line that is truncated with "…" on desktop wraps onto more lines on phones instead (long words break too).
export const PHONE_WRAP_TEXT = "max-lg:whitespace-normal max-lg:[overflow-wrap:anywhere]";
```

- [ ] **Step 4:** The test file passes (all its tests).
- [ ] **Step 5: Tasks page** (`app/(dashboard)/dashboard/tasks/page.tsx`): add `import { PHONE_WRAP_TEXT } from "@/lib/dashboard-phone";`. In `TaskRow`:
  - `<div className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2">` → `<div className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2 max-lg:items-start">`
  - `<p className="truncate text-sm text-[#1B1B1B]">{task.title}</p>` → ``<p className={`truncate text-sm text-[#1B1B1B] ${PHONE_WRAP_TEXT}`}>{task.title}</p>``
- [ ] **Step 6: Lead Tasks tab** (`components/leads/LeadTasksTab.tsx`): same import. In `TaskRow`:
  - the row class string `` `flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${accent ?? "bg-[#F2F0EF]"} hover:brightness-95` `` → append ` max-lg:items-start` inside the template literal.
  - the title `` `truncate text-sm ${task.done ? …}` `` → `` `truncate text-sm ${PHONE_WRAP_TEXT} ${task.done ? …}` `` (insert `${PHONE_WRAP_TEXT} ` after `text-sm `).
  - Quick row `<div className="flex gap-2">` (under `{/* Quick tasks */}`) → `<div className="flex gap-2 max-lg:grid max-lg:grid-cols-2">`.
  - "+ New Task" button `className="ml-auto rounded-lg bg-[#1B1B1B] px-3 py-1.5 text-xs font-medium text-white"` → append ` max-lg:ml-0`.
- [ ] **Step 7:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 8:** Commit `feat: phones — task titles wrap to show in full; lead quick-task buttons in a 2×2 grid`.
- [ ] **Controller after:** FINGERPRINT vs `base1` all identical, PIXEL identical; SURVEY admin+agent: `tasks`, `lead-tasks` screenshots at 320/390/820 — titles wrap, dates stay right, quick buttons 2×2.

### Task 3: Leads page — pill row, swipe columns, results table

**Files:** Modify `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx`, `apps/web/src/components/leads/SmartListSidebar.tsx`, `apps/web/src/components/dashboard/LeadKanban.tsx`, `apps/web/src/components/leads/SmartListResults.tsx`

**Interfaces — Consumes:** `PHONE_TAB_BAR`, `PHONE_HEADER_STACK` from `@/lib/dashboard-phone`.

- [ ] **Step 1: Page frame** (`leads/page.tsx`):
  - `<div className="-m-8 flex min-h-[calc(100vh-4rem)] max-lg:-m-4 max-lg:min-h-[calc(100svh-4rem-2.75rem)]">` → append ` max-lg:flex-col`.
  - `<div className="flex-1 overflow-auto p-8">` → `<div className="flex-1 overflow-auto p-8 max-lg:min-w-0 max-lg:p-4">`.
- [ ] **Step 2: Sidebar → pill row** (`SmartListSidebar.tsx`): add `import { PHONE_TAB_BAR } from "@/lib/dashboard-phone";`.
  - Root `<div className="flex w-[200px] flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-3 py-6">` → ``<div className={`flex w-[200px] flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-3 py-6 max-lg:w-full max-lg:flex-row max-lg:items-center max-lg:gap-1 max-lg:border-b max-lg:border-r-0 max-lg:px-4 max-lg:py-3 max-lg:[&_button]:w-auto max-lg:[&_button]:shrink-0 max-lg:[&_button]:whitespace-nowrap ${PHONE_TAB_BAR}`}>``
  - Both section wrappers `<div className="mt-4">` (the "Smart Lists" one and the "My Lists" one) → `<div className="mt-4 max-lg:contents">`.
  - Both section headings `<p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">` → append ` max-lg:hidden`.
  - Custom list row `<div key={list.id} className="group relative flex items-center">` → `<div key={list.id} className="group relative flex items-center max-lg:shrink-0">`.
  - Its name button class `` `${linkClass(selected === list.id)} flex-1 truncate pr-14` `` → `` `${linkClass(selected === list.id)} flex-1 truncate pr-14 max-lg:pr-1` ``.
  - The ✎/× group `<div className="absolute right-1 hidden gap-0.5 group-hover:flex">` → `<div className="absolute right-1 hidden gap-0.5 group-hover:flex max-lg:static max-lg:flex">`.
  - "+ New List" button class `"mt-4 w-full rounded-lg border border-dashed … hover:text-[#9E8C61]"` → append ` max-lg:mt-0`.
  - Desktop untouched: every new word is `max-lg:`; `linkClass` itself is not changed.
- [ ] **Step 3: Board columns** (`LeadKanban.tsx`):
  - `<div className="flex gap-4 overflow-x-auto pb-4">` → `<div className="flex gap-4 overflow-x-auto pb-4 max-lg:snap-x max-lg:snap-proximity">`.
  - `<div key={status} className="flex w-56 flex-shrink-0 flex-col gap-3">` → `<div key={status} className="flex w-56 flex-shrink-0 flex-col gap-3 max-lg:w-[85%] max-lg:snap-start">`.
  - `<div className="mb-4 flex justify-end">` (above the board, holds "+ Add Lead") → `<div className="mb-4 flex justify-end max-lg:[&>*]:w-full">`.
- [ ] **Step 4: Results** (`SmartListResults.tsx`; extend its existing `@/lib/dashboard-phone` import with `PHONE_HEADER_STACK`):
  - Header `<div className="mb-6 flex items-center justify-between">` (under `{/* Header */}`) → ``<div className={`mb-6 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-1`}>``.
  - `<table className="w-full">` → `<table className="w-full max-lg:whitespace-nowrap">`.
- [ ] **Step 5:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 6:** Commit `feat: phones — leads smart lists as a swipe pill row (edit/delete always visible), board columns snap one at a time, results table scrolls`.
- [ ] **Controller after:** FINGERPRINT vs `base1` identical, PIXEL identical; SURVEY admin+agent clean; screenshots 320/390/820 of leads-board, list-hot, list-custom, list-new-drawer: pill row one line and swipeable, ✎/× visible, board one column + peek (iPad too), table not squeezed.

### Task 4: Pipeline header, full-width cards, Deal drawer layer

**Files:** Modify `apps/web/src/app/(dashboard)/dashboard/pipeline/page.tsx`, `apps/web/src/components/deals/DealBoard.tsx`, `apps/web/src/components/deals/DealDrawer.tsx`

- [ ] **Step 1: Pipeline header** (`pipeline/page.tsx`; add `import { PHONE_HEADER_STACK } from "@/lib/dashboard-phone";` — extend the existing import if the file already has one):
  - `<div className="mb-6 flex items-center justify-between">` (holding `<h1>Pipeline</h1>` and "+ New Deal") → ``<div className={`mb-6 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``.
- [ ] **Step 2: Drop zone** (`DealBoard.tsx`, `DroppableStage`): `className="flex w-56 min-h-[120px] flex-col gap-2 rounded-2xl bg-[#1B1B1B]/5 p-2"` → append ` max-lg:w-full`.
- [ ] **Step 3: Deal drawer** (`DealDrawer.tsx`): `` className={`fixed inset-0 z-40 ${open ? "" : "hidden"}`} `` → `` className={`fixed inset-0 z-50 ${open ? "" : "hidden"}`} `` — the one approved all-sizes change (matches LeadTaskDrawer / ActionPlan / Trigger drawers, which are `z-50`).
- [ ] **Step 4:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 5:** Commit `fix: deal drawer sits above the site's top bar (title and close button visible); phones — pipeline header stacks, deal cards full width`.
- [ ] **Controller after:** FINGERPRINT vs `base1` identical (z-index changes no boxes); PIXEL: `deal-drawer` desktop shots now DIFFER from base — expected; open both and confirm the only difference is the drawer title + × now showing above the top bar. Record as the approved exception. SURVEY clean; screenshots 320/390/820 of pipeline-buyers, deal-drawer, new-deal-modal.

### Task 5: Phone walk of the controls (controller, fixes dispatched)

- [ ] Serve 3100. At 320×568, 390×844, 820×1180, admin and agent, with non-GET API aborted:
  - Leads: swipe the pill row to its end (scrollLeft to max) — every pill reachable; tap a built-in list → URL `?list=` changes and results show; tap the custom list's ✎ → Smart List drawer opens (close it); tap × → its DELETE request is aborted (confirm the request was attempted, list stays).
  - Board: scroll the column container to the last column — each column snaps; "+ Add Lead" opens the New Lead popup (close it).
  - Lead profile: Tasks tab — tap a task → task drawer opens; quick buttons 2×2 visible.
  - Pipeline: each type tab; tap a deal → drawer title and × visible, × closes it; "+ New Deal" → type `ZZ` in the lead search, results list fits.
  - Tasks: the long title wraps fully; tap the lead link → navigates to the lead.
  - Record overflow, elements past the viewport, fields <16px, reachability; screenshots.
- [ ] For each problem: one fix, reusing an existing bundle first; FINGERPRINT identical after it. If none: record "walk clean".
- [ ] Stop 3100.

### Task 6: Real-phone drag test (Ryan drives)

- [ ] Clean build of HEAD; serve on the Wi-Fi address: `cd apps/web && npx next start -H 0.0.0.0 -p 3100`. Find the PC's address (`ipconfig` → Wi-Fi IPv4). Tell Ryan the address `http://<ip>:3100`; if Windows asks to allow Node through the firewall, Ryan approves it (private network only). If the phone cannot reach it, stop and report — do not change firewall settings without Ryan.
- [ ] Ryan logs in on his phone as `zz-sample-agent@example.com` / `ZzSampleAgent2026!` and, one step at a time (Claude checks the DB result after each):
  1. Leads board: long-press (~0.5s) "ZZ Sample Samantha O'Connor-Whitfield" (Showing) and drop it in the next column → Claude confirms the lead's status changed.
  2. Quick swipe across the board → it scrolls, no card picked up, no text-selection popup.
  3. Long-press a card and drag it toward the right edge → the board scrolls to further columns while dragging; drop it → status confirmed.
  4. Pipeline: long-press "ZZ Sample Daniel Kim" (Offer Submitted) and drop it in another stage → Claude confirms the deal's stage changed.
  5. The pill row: swipe, tap "Hot Prospects", tap "Kanban".
- [ ] Any failure: systematic-debugging, fix, rebuild, Ryan repeats that step. Stop the server. (Sample statuses changed here are fine — the final fingerprints come from Task 7 against a re-created sample set, see below.)

### Task 7: Final verification (controller)

- [ ] Reset the samples so fingerprints compare like-for-like: `node _samples7d.mjs delete && node _samples7d.mjs create && node _samples7d.mjs agent && node _samples7d.mjs lists`. Because IDs change, re-take the baseline from the old build: serve the **old build** (`<scratchpad>/b7d`) on 3101 and run FINGERPRINT `base-final` against it; then serve HEAD on 3100 and run FINGERPRINT `final base-final` → all identical; PIXEL identical except the deal-drawer shots (approved). Run it twice.
- [ ] SURVEY admin + agent at all four sizes with screenshots: zero overflow, zero small fields; compare to `s-base`/`a-base` — every row of the spec's survey table fixed.
- [ ] SPEED A/B: HEAD on 3100 vs old build on 3101, interleaved 3100, 3101, 3100, 3101 desktop, then 3100, 3101 phone. JS request counts equal; timings within noise (re-run more pairs if a page looks slower).
- [ ] Stop both servers; remove the `b7d` worktree (`git worktree remove --force`, then `cmd /c 'rmdir /s /q "\\?\<full path>"'` if the path is too long — write the path literally, not via a variable).
- [ ] **After the final whole-branch review is clean:** `node _samples7d.mjs delete && node _samples7d.mjs count` → all zeros; confirm users = Ryan's admin only; delete `_samples7d.mjs`. Update memory (7d complete, next 7e). CLAUDE.md is not updated (Ryan: only after 7e).
