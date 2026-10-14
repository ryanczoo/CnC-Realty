# Mobile Layout — Sub-project 7e: the 13 other admin pages

**Parent specs:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px,
desktop never changes, fluid 320–1023px incl. sideways phones, no new libraries, load speed not worse),
`2026-10-06-mobile-dashboard-shell-design.md` (7a: shell, `lib/dashboard-phone.ts` bundles),
`2026-10-07-…transactions-design.md` (7b: stacked headers), `2026-10-10-…campaigns-academy-account-design.md`
(7c), `2026-10-11-mobile-dashboard-boards-design.md` (7d: `PHONE_WRAP_TEXT`).
**Date:** 2026-10-13 · **Status:** Design approved by Ryan 2026-10-13 (spec awaiting review)

## Scope

All paths under `apps/web/src/app/(dashboard)/admin/`.

| Page | File(s) | 7e change? |
|---|---|---|
| Admin home | `page.tsx` | no |
| All Agents (+ title / email-limit inline editors) | `agents/*` | no |
| All Leads (+ Add Lead, Unassigned, merge bar) | `leads/*` | no |
| Applications list | `applications/ApplicationsClient.tsx` | **yes** |
| Application detail (+ reject reason) | `applications/[id]/page.tsx` | **yes** |
| Action Plans (+ new / detail drawers) | `action-plans/page.tsx` | **yes** |
| Triggers (+ new / edit drawers) | `triggers/page.tsx` | **yes** |
| Reports | `reports/*` | no |
| Checklists (+ template editor) | `settings/checklists/page.tsx` | **yes** |
| Tags | `settings/tags/AdminTagsClient.tsx` | **yes** |
| Blog list, new post, edit post | `blog/*` | no |

**Sample data (Ryan's OK, 2026-10-13), created directly in the database so no email or automation fires**
(`.superpowers/7e-survey/seed7e.mjs`, IDs in `ids7e.json`): 3 agents + logins (`zz-sample-agent1..3`),
10 leads (`zz-sample-lead*@example.com`, one long email, one unassigned), 5 activities, 4 deals,
2 applications (PENDING with long name/address/bio; REJECTED), 1 action plan with 3 steps, 2 triggers
(one inactive), 1 long tag. All deleted at the end of 7e with `clean7e.mjs`, which must report zero leftovers.

## Survey (production build of `c6f524d`, 2026-10-13)

Every page at 320×568, 390×844, 844×390, 820×1180 (`survey7e.cjs`), and every popup, drawer and inline
editor at 320, 390, 820 (`interact7e.cjs`), numbers plus screenshots, as admin.

| # | Problem | Where | Size |
|---|---|---|---|
| 1 | Fixed 192px label column squeezes each value into a sliver; email runs +98px off-screen (+28 at 390); name + status header squeezes | Application detail | 320–390 |
| 2 | Filter pills run +61px off-screen | Applications list | 320 |
| 3 | "+ New Plan" squeezed into a 3-line circle beside the title | Action Plans | 320–390 |
| 4 | "+ New Trigger" wraps beside the title | Triggers | 320–390 |
| 5 | "New Template" wraps beside the title | Checklists | 320–390 |
| 6 | Trigger name squeezed to ~4 words a line by the badge + Edit/Delete beside it | Triggers rows | 320–390 |
| 7 | 8th colour dot clipped off the card | Tags → Create Tag | 320 |

Already fine on phones: admin home; All Agents / All Leads / Reports / Applications / Blog tables (swipe inside
their card via `PHONE_TABLE_FRAME`); Add Lead, Unassigned, merge bar; action-plan and trigger drawers;
checklist editor; reject-reason box; blog editor (new + edit); no field under 16px anywhere.

Left as is (Ryan, 2026-10-13): the agent title inline editor's Save sits past the card edge but is reachable by
swiping the table; blog titles, plan descriptions and step titles end in "…" — same as desktop by design;
the All Agents name column shows the slug (existing desktop behaviour).

## Hard constraints

1. **Desktop (≥1024px) is pixel-identical.** Existing class strings are only appended to, with phone-only
   words (`max-lg:`, `max-sm:`). No class is removed or reordered in a way that changes desktop.
2. **Reuse first:** `PHONE_TAB_BAR`, `PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`, `PHONE_WRAP_TEXT` from
   `lib/dashboard-phone.ts`. No new bundle (each remaining fix is used in one place only), no new component,
   no new library. `lib/dashboard-phone.ts` is not edited.
3. Load speed not worse on desktop or phone (measured before/after). Nothing pushed until 7e is complete.

## Design

### 1. Application detail — label above value (Ryan's choice)

- `Row` wrapper `flex gap-4 py-2 border-b …` gains `max-lg:flex-col max-lg:gap-1`.
- Label `w-48 shrink-0 …` gains `max-lg:w-auto`.
- Value `text-sm text-[#1B1B1B]/80` gains `PHONE_WRAP_TEXT` (long emails/addresses break instead of
  running off-screen).
- Header `mb-6 flex items-center justify-between` gains `PHONE_HEADER_STACK` + `max-lg:gap-2`, the `<h1>`
  gains `PHONE_WRAP_TEXT`, and the status badge gains `max-lg:self-start`: name on top, badge below at its
  natural width. (`self-start` on the badge, not `items-start` on the row — Tailwind emits `items-stretch`
  after `items-start`, so the bundle's stretch would win a same-breakpoint tie.)
- Approve / Reject and the reject-reason box are unchanged (already fine).

### 2. Applications list — swipeable filter row

- Filter row `mb-4 flex gap-2` gains `PHONE_TAB_BAR`.

### 3–5. Action Plans, Triggers, Checklists headers — same as 7b/7c pages

- Header rows (`action-plans/page.tsx:45`, `triggers/page.tsx:97`, `settings/checklists/page.tsx:60`)
  gain `PHONE_HEADER_STACK` + `max-lg:gap-3`; the "+ New …" button gains `max-lg:w-full
  max-lg:justify-center` (title on top, full-width button below — the layout already used on the
  transaction and campaign pages). In all three files the button is the header's direct child (no wrapper
  div), so `PHONE_HEADER_ACTIONS` — which styles a wrapper's children — has nothing to attach to; the two
  words go on the button itself. The Checklists button is already `flex items-center`, so
  `justify-center` centres its icon + label; the two `motion.button`s centre their text by default.

### 6. Triggers rows — name full width, controls on the line below (Ryan's choice)

The row's five pieces (checkbox, name block, badge, Edit, Delete) are siblings, so `PHONE_HEADER_STACK` would
put each on its own line. Instead, the same visible result with a phone-only wrap:

- Row `flex items-center gap-4 px-5 py-4` gains `max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-2`.
- Name block `flex-1 min-w-0` gains `max-lg:basis-[calc(100%-2rem)]` (checkbox + name fill line 1).
- Badge gains `max-lg:ml-7` so badge · Edit · Delete start under the name on line 2.
- The delete confirm (Delete? Confirm Cancel) sits on line 2 the same way.

### 7. Tags — colour dots wrap

- Create Tag dot row `flex gap-1` (`AdminTagsClient.tsx:96`) gains `max-lg:flex-wrap`. The edit-row dots
  (inside the swipeable table) are unchanged.

## Verification

- **Desktop fingerprint:** before the first change, element boxes and screenshots of all 13 pages plus every
  popup / drawer / inline editor in `interact7e.cjs`, at 1440×900 and 1024×768, as admin. Re-run after every
  task; any difference stops the work.
- **Phones:** `survey7e.cjs` + `interact7e.cjs` at 320×568, 390×844, 844×390, 820×1180 — problems 1–7 gone,
  nothing new sideways or cut off, fields still 16px. Screenshots checked every time, not only the numbers.
- **Speed:** interleaved fresh-profile runs of the pre-7e build vs the new build — Applications, Application
  detail, Action Plans, Triggers, Checklists, Tags; desktop and phone. Reported as a before/after table.
- **Tests:** the existing `__tests__/lib/dashboard-phone.test.ts` (every bundle phone-only) stays green; the
  per-page checks are the automated surveys above (same as 7a–7d; there are no page-level layout unit tests).
  Full suite + `tsc --noEmit` + clean production build after every task.
- **Real phone (optional, Ryan drives):** production build on this computer's Wi-Fi address if Ryan wants
  a hands-on pass.
- **Cleanup:** `clean7e.mjs` → zero leftovers; delete the seed/clean copies.

## Out of scope

Desktop changes, new features, the "Left as is" items above, CLAUDE.md update and push (both after 7e is
complete, per Ryan), the font trim follow-up.
