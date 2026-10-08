# Mobile Layout — Sub-project 7b: Transactions (agent + admin file pages)

**Parent specs:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px,
desktop never changes, fluid 320–1023px incl. sideways phones, no new libraries, load speed not worse) and
`docs/superpowers/specs/2026-10-06-mobile-dashboard-shell-design.md` (7a: shell + shared phone bundles in
`lib/dashboard-phone.ts`).
**Date:** 2026-10-07 · **Status:** Draft for Ryan's review

## Scope (agreed with Ryan 2026-10-07)

| Page | File |
|---|---|
| File list (agent) | `app/(dashboard)/dashboard/transactions/page.tsx` |
| File detail (agent, all 7 transaction tabs / 6 listing tabs) | `app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` |
| New Transaction wizard (every step) | `app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` |
| New Listing wizard (every step) | `app/(dashboard)/dashboard/transactions/new-listing/page.tsx` |
| All Files (admin) | `app/(dashboard)/admin/transactions/page.tsx` |
| File detail (admin) | `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx` |

Admin file pages are included (Ryan's call) because they share most parts with the agent pages
(`components/transactions/*`: FileCard, OverviewTab, CommissionTab, DocumentsTab, PartiesTable,
ActivityFeed, StatusBadge, FileStatusSelect). 7e then covers the other 13 admin pages.

**Sample data (Ryan's OK, 2026-10-07):** two clearly fake files under the admin account, created through
the real `POST /api/transactions` and `POST /api/listings` routes:
- Transaction `cmuyp01k5000110p7ck96mrp5` — Purchase, Under Contract → Pending, long address, 3 parties,
  9-item checklist.
- Listing `cmuyp0239000h10p7adcgwcqc` — Residential Sale, 1 seller.

Both are deleted at the end of 7b (with their checklist items, parties, documents, tasks, activity), and
zero orphaned rows are confirmed afterwards.

## Survey (production build of `01863be`, logged in as admin, 2026-10-07)

Measured on the dashboard's own scrolling `<main>` (the page has two `<main>` elements; the inner one
scrolls). Content cut off inside an `overflow:hidden` box counts as a problem.

| Problem | 320×568 | 390×844 | 844×390 / 820×1180 |
|---|---|---|---|
| File detail header: "Submit for Review" + status select beside the address (agent, every tab) | 223px (transaction) / 140px (listing) | 153 / 70 | 0 |
| Wizard step bar runs off the right edge and is clipped ("Co…") | New Transaction 217, New Listing 86 | 147 / 16 | 0 |
| File list "New Listing / New Transaction" buttons | 76 | 6 | 0 |
| Admin file detail status-button row | 21 | 0 | 0 |
| New Listing date fields (side effect of 7a's `max-lg:w-8` DateField segments in a 2-column grid) | 3–23 | 0 | 0 |

The tab contents themselves (property details, checklist rows, key dates, parties table, documents,
activity) already fit at every size. The admin All Files page already fits. Form fields are already 16px
on phones (7a's `PHONE_FIELDS_16` on the shell). The wizards were surveyed on step 1 only; later steps are
checked step by step during the build (see Verification).

## Hard constraints

1. **Desktop (≥1024px) is pixel-identical.** Existing class strings are never edited except to *append*
   phone-only words. Phone words are prefixed `max-lg:` (below 1024px) or `max-sm:` (below 640px — still
   phone-only). The one structural change (shared step bar, §1) must produce identical desktop server HTML once
   the appended phone-only words are stripped, and identical desktop element boxes.
2. Reuse first: 7a's bundles in `lib/dashboard-phone.ts`, `FormField`, `DateField`, existing
   `components/transactions/*`. A new shared bundle/component only when the same fix is needed in more
   than one place.
3. No new libraries. Load speed not worse on desktop or phone (measured before/after).
4. Nothing pushed to GitHub until 7e is complete (Ryan, 2026-10-07).

## Design

### 1. Shared wizard step bar — `components/transactions/WizardStepBar.tsx`

Both wizards contain the same step-bar markup copied verbatim. It moves into one component:

```tsx
<WizardStepBar steps={STEPS} current={displayStep} />   // New Transaction (keeps the referral displayStep mapping)
<WizardStepBar steps={STEPS} current={step} />          // New Listing
```

- **Desktop:** renders exactly today's markup (dot + label per step, `h-px flex-1` lines between), wrapped
  so it is hidden below 1024px (`max-lg:hidden` appended to the outer `mb-20 mx-auto flex max-w-5xl
  items-center` div). Desktop server HTML of both wizards must be identical before/after once the appended /
  words are stripped.
- **Phones (Ryan's choice — compact):** a second block, `lg:hidden`, showing one dot per step (gold =
  done, dark = current, faint = to do) and the line `Step {n} of {total} · {current step name}`.
- The label text comes from a pure, tested helper `wizardStepLabel(steps, current)` →
  `"Step 2 of 6 · Property"`; out-of-range `current` clamps to the last step (covers referral's reused
  Review index 5 on a shorter step list — today's `displayStep` mapping already handles it, the clamp is a
  guard).
- Phone spacing: the wizard's heading block `mb-16` and the step bar's `mb-20` gain `max-lg:mb-6` /
  `max-lg:mb-8` so the form starts higher.

### 2. File detail header — agent and admin

Both pages use `flex items-start justify-between gap-4` with the address/badge on the left and the
actions on the right. On phones (Ryan's choice — stack):

```
12345 ZZ Sample Mountainview Boulevard Unit 1408   ← full width
Rancho Palos Verdes, CA 90275
(Pending)
[ Submit for Review              ]                 ← full-width row
[ Pending                      ▾ ]                 ← full-width row
```

- One new bundle in `lib/dashboard-phone.ts`, used by both pages (same fix in two places):
  `PHONE_HEADER_STACK = "max-lg:flex-col max-lg:items-stretch"` on the header row, and
  `PHONE_HEADER_ACTIONS = "max-lg:w-full max-lg:flex-col max-lg:[&>*]:w-full"` on the actions group.
  Exact words are settled in the plan against the real markup (the select and button must reach full
  width without changing their desktop boxes).
- Admin page: the status-button row (`flex items-center gap-2`) also gains `max-lg:flex-wrap` so the
  buttons wrap instead of running 21px off-screen.

### 3. File list header (agent)

`mb-6 flex items-center justify-between` → on phones the heading sits on its own line and the two buttons
form a half-width pair below it (Ryan's choice): `max-lg:flex-col max-lg:items-stretch max-lg:gap-3` on
the row, `max-lg:grid max-lg:grid-cols-2` on the `flex gap-2` button group (buttons stretch to their
cell). The admin All Files list already fits — no change.

### 4. Wizard field pairs and card padding (fixes the 7a DateField side effect)

- Every `grid grid-cols-2 gap-4` field pair inside the two wizard cards gains `max-sm:grid-cols-1`
  (one field per row below 640px). One bundle: `PHONE_FIELD_PAIR = "max-sm:grid-cols-1"`.
- The wizard card (`rounded-2xl ... p-10`) gains `max-lg:p-5` so phones get usable width.
- The dashboard-phone prefix test is extended to allow `max-sm:` as well as `max-lg:` (both are
  phone-only).

### 5. Everything else reuses what exists

Tab bars already use `PHONE_TAB_BAR`, tables already scroll inside `PHONE_TABLE_FRAME`, fields are 16px
via `PHONE_FIELDS_16`. If a later wizard step or an in-tab control (upload, add party, add task, notes,
inline edit, status-change popups) turns out to overflow during the step-by-step check, it is fixed with
the existing bundles first, a new phone word only if none fits.

## Verification

- **Desktop fingerprint:** before the first change, record element boxes of all 19 page/tab views × 2
  widths (1440, 1024) = 38 snapshots using the sample files, plus server HTML of both wizards (compared with appended phone words stripped). Re-run after
  every task; any difference stops the work until explained and fixed.
- **Phones:** 320×568, 390×844, 844×390, 820×1180 — no page-level sideways scroll, nothing cut off in the
  dashboard `<main>`, fields 16px, every button reachable. Each wizard is walked step by step at 320 and
  390 with sample input; the file detail's in-tab controls (upload button, add party, add task, add note,
  inline edit, status select) are opened at 390.
- **Speed:** at the end, interleaved fresh-profile runs of the old build (`01863be`) and the new build —
  list page and a file detail page, desktop and phone — using `.superpowers/speed-ab.cjs`. Expect no
  difference.
- **Tests:** `wizardStepLabel` unit tests (normal, last step, referral clamp); dashboard-phone prefix test
  covers the new bundles; full suite + `tsc --noEmit` + clean production build after every task.
- **Cleanup:** delete both sample files and confirm zero orphaned children.

## Out of scope

New Deal popup lead search (Pipeline → 7d); the other 13 admin pages (7e); any desktop change; new
features; the ~5 KB phone-menu chunk that also loads on desktop (Ryan: leave it).
