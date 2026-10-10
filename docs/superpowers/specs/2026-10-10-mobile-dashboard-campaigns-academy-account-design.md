# Mobile Layout — Sub-project 7c: Campaigns, Academy, Settings, client /account

**Parent specs:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px,
desktop never changes, fluid 320–1023px incl. sideways phones, no new libraries, load speed not worse),
`2026-10-06-mobile-dashboard-shell-design.md` (7a: shell + bundles in `lib/dashboard-phone.ts`),
`2026-10-07-mobile-dashboard-transactions-design.md` (7b: stacked headers).
**Date:** 2026-10-10 · **Status:** Draft for Ryan's review

## Scope

| Page | File |
|---|---|
| Campaigns list | `app/(dashboard)/dashboard/campaigns/page.tsx` |
| Campaign detail (email draft, email sent, drip) | `app/(dashboard)/dashboard/campaigns/[id]/page.tsx` |
| New Campaign wizard (4 steps, email + drip) | `app/(dashboard)/dashboard/campaigns/new/page.tsx` |
| Training Videos, Documents | `app/(dashboard)/dashboard/academy/videos/page.tsx`, `.../guides/page.tsx` |
| Announcements + composer | `app/(dashboard)/dashboard/academy/announcements/page.tsx`, `AnnouncementComposer.tsx` |
| Settings | `app/(dashboard)/dashboard/settings/page.tsx` |
| Client account (buyers) | `app/(account)/account/page.tsx` |

**Sample data (Ryan's OK, 2026-10-10), created directly in the database so no email is ever sent**
(IDs in `.superpowers/7c-survey/sample-ids.json`): 3 fake leads (example.com), an email draft campaign, an
email campaign marked COMPLETED with 3 fake recipients (clicked / opened / sent), a drip campaign with 2
steps, one past announcement, and a fake client login (`zz-sample-client@example.com`) with 2 saved homes.
All deleted at the end of 7c with a zero-leftovers check.

## Survey (production build of `f42385c`, 2026-10-10)

Measured on the inner dashboard `<main>` (the page has two `<main>` elements; `/account` uses the page),
4 sizes (320×568, 390×844, 844×390, 820×1180), plus screenshots.

| Problem | Where | Size |
|---|---|---|
| "+ New Campaign" squeezes beside the heading, label wraps to 2 lines | Campaigns list | 320–390 |
| Campaign name squeezed into a narrow column beside the status badge and Delete | Campaign detail | 320–390 |
| "+ New Announcement" crowds the heading; overflows | Announcements | 25px @320 |
| Composer opens beside the heading instead of below it | Announcements | 133px @320, 63px @390 |
| Date squeezed beside the title, wraps to 3 lines | Announcement cards | 390 |
| Tabs squeeze ("Saved Properties", "Tour Requests" wrap); on one line they need ~374px vs ~272–342px available | `/account` | 320–390 |
| Display Name field is 14px (iPhone zooms) — `/account` is outside the dashboard, so 7a's 16px rule doesn't apply | `/account` Settings | all phones |

Already fine on phones: Training Videos, Documents, Settings, all 4 wizard steps (content editor,
recipients, drip editor, schedule), campaign stats boxes, campaign list cards.

## Hard constraints

1. **Desktop (≥1024px) is pixel-identical.** Existing class strings are only appended to, with phone-only
   words (`max-lg:` = below 1024px, `max-sm:` = below 640px). The only new file is `lib/account-tabs.ts` (tab names + short labels); the only new elements are phone-only label
   spans (`lg:hidden`) beside desktop label spans (`max-lg:hidden`) on the `/account` tabs.
2. Reuse first: 7a/7b bundles in `lib/dashboard-phone.ts` (`PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`,
   `PHONE_FIELDS_16`). No new bundle or component unless the same fix is needed in more than one place.
3. No new libraries. Load speed not worse on desktop or phone (measured before/after).
4. Nothing pushed to GitHub until 7e is complete.

## Design

### 1. Stacked headers (Ryan's choice — same as 7b)

- **Campaigns list** — header row `mb-8 flex items-center justify-between` gains `PHONE_HEADER_STACK` +
  `max-lg:gap-3`; the "+ New Campaign" link gains `max-lg:justify-center` so it is a full-width button
  below the heading, description and send count.
- **Campaign detail** — header row `flex items-start justify-between gap-4` gains `PHONE_HEADER_STACK`;
  the name + badge row `flex items-center gap-3` gains `max-lg:flex-col max-lg:items-start max-lg:gap-2`
  (badge under the name); the actions group `flex items-center gap-2` (Send Now / Start Now / Delete)
  gains `PHONE_HEADER_ACTIONS` (each action a full-width row).
- **Announcements** — header row `mb-6 flex items-center justify-between` gains `PHONE_HEADER_STACK` +
  `max-lg:gap-3`. In `AnnouncementComposer.tsx` the "+ New Announcement" button gains `max-lg:w-full`;
  the composer panel then sits full width under the heading (it is the same flex child).

### 2. Announcement cards (Ryan's choice — date under the title)

The card's title row `mb-2 flex items-center justify-between` gains `max-lg:flex-col max-lg:items-start
max-lg:gap-1`; the date span gains `max-lg:whitespace-nowrap` (one line: "Oct 6, 2026").

### 3. `/account` (client page)

- **Tabs (Ryan's choice — shorter labels on phones):** each tab button renders the full label in a
  `max-lg:hidden` span and a short phone label in a `lg:hidden` span. The tab names move to a small module `lib/account-tabs.ts` exporting `ACCOUNT_TABS`
  (the existing three names) and `accountTabShortLabel(tab)`: "Saved Properties" → "Saved", "Tour Requests"
  → "Tours", "Settings" → "Settings"; the page imports both. Tab state still uses
  the full names; only the visible text changes. All three fit on one line at 320px and up.
- **Settings tab fields:** the settings column `flex flex-col gap-5 max-w-lg` gains `PHONE_FIELDS_16`
  (16px inputs on phones).

### 4. No change

Training Videos, Documents, Settings page, the wizard steps, campaign stats and list cards — already fit.

## Verification

- **Desktop fingerprint:** before the first change, record element boxes of 15 views × 2 widths
  (1440, 1024) = 30 snapshots with the samples in place: campaigns list, 3 campaign details, 4 wizard
  steps, videos, documents, announcements (closed and composer open), settings, 3 `/account` tabs (as the
  fake client). Re-run after every task; any difference stops the work until explained and fixed.
- **Phones:** the same views at 320×568, 390×844, 844×390, 820×1180 — no page-level sideways scroll,
  nothing cut off, fields 16px, every button reachable, `/account` tabs on one line. Screenshots checked
  every time, not only the numbers. Also opened: the drip editor's "+ Add Step" form, "Schedule for Later"
  date-time field, the wizard's lead search.
- **Speed:** at the end, interleaved fresh-profile runs of the pre-7c build vs the new build — campaigns
  list, a campaign detail, announcements (admin) and `/account` (client), desktop and phone.
- **Tests:** the dashboard-phone prefix test stays green; a unit test pins `accountTabShortLabel` for all
  three tabs; full suite + `tsc --noEmit` + clean production build after every task.
- **Cleanup:** delete all samples and confirm zero rows remain.

## Out of scope

Desktop changes, new features, boards (7d), the 13 other admin pages (7e).
