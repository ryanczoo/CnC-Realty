# Walkthrough fixes — Sub-project A: display and wording fixes

**Date:** 2026-09-20
**Origin:** Found during the live Purchase-transaction walkthrough (agent + admin, local dev against the shared Neon DB).
**Scope:** 13 small, mostly independent fixes. Sub-projects B (review/status/email flow), C (input rules) and D (commission redesign) get their own specs.
**Explicitly out:** #5 New Listing type cards (deferred by Ryan until A–D are done), #16 global form-field text color (deferred).

## Reuse audit (done before designing)

| Need | Already in the codebase? | Decision |
|---|---|---|
| Tooltip / popover | **No.** No Radix/Base UI packages installed, no tooltip component, shadcn `components.json` has no registries configured (MCP search returns nothing). Only native `title=` on two admin icon buttons. | New tiny `components/ui/Tooltip.tsx`, pure CSS, no new dependency. |
| Loading spinner | **No shared component.** `<Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />` is copy-pasted in 6 pages. | New `components/ui/Spinner.tsx` with that exact look and a size prop, used for all *new* spots. The 6 existing copies are left alone (out of scope; easy follow-up). |
| Date formatting | `lib/utils.ts formatDate` formats in **local** time and is used for real timestamps (createdAt etc.) — must not change. `lib/deal-pipeline.ts formatCloseDate` is UTC-safe but has no year and is deal-specific. | Add `formatDateOnly` next to `formatDate` in `lib/utils.ts` (UTC, with year). `formatDate` untouched. |
| Read a tab from the URL | `dashboard/pipeline/page.tsx` already reads `useSearchParams()` for its tab. | Follow that pattern in the file detail page. |
| List all files for admin | `api/admin/audit-queue` has the exact guard + include shape. | New `GET /api/admin/files` copying that shape, without the `awaitingReview` filter. |
| Party role labels | `PartiesTable.tsx` has a local role-label map; `types/transaction.ts` has a differently-purposed `ROLE_LABELS` keyed by transaction side (same name, easy to confuse). | Extend the `PartiesTable` map and the `FilePartyRole` type; do not touch the transaction-side map. |
| Email shell/escaping | `emailLayout`, `buildHeadingBodyHtml`, `escapeHtml` in `lib/email.ts`. | Reuse; only change wording. |
| Activity data | Upload/approve/reject activity payloads **already store** `name` (and reject stores `note`). | #23 is display-only and works for existing rows too. |

## The fixes

**#3 TC toggle knob.** The knob `<span>` is `absolute` with a translate but no left anchor, so it lands mid-button (off looks on; on overflows the track). Add `left-0`. Grep for the same pattern elsewhere and fix any copies.

**#6 Commit finished work.** Wizard heading/card centering (`new-transaction/page.tsx`) and the black text on the rejection-reason box (`DocumentReviewCard.tsx`) are already edited; commit them.

**#7 Loading spinners.** New `Spinner` component. Show it (with the existing text, e.g. "Creating…") on: the Create button in New Transaction and New Listing, the per-row Upload buttons and "Add Document" in `ChecklistPanel`, and Submit for Review on the file page.

**#8 Dates one day early.** Date-only fields are stored as UTC midnight and currently rendered with local-time `toLocaleDateString()`, so California shows the previous day. Use `formatDateOnly` for date-only fields only: file page (list/expiration, date referred, offer/acceptance/inspection/appraisal/loan/COE/expiration/walkthrough/possession, condition due date, file-task due date), `FileCard` COE, admin overview deadline rows, deadline email date, public agent transaction month. **Not changed:** real timestamps (uploadedAt, createdAt, activity times) and lead-task due dates (stored as date+time, so local rendering is correct).

**#9 Escrow company overwritten.** The wizard sends `company: <Title|Escrow|Attorney>`, discarding the typed company. Add `TITLE`, `ESCROW`, `ATTORNEY` to the `FilePartyRole` DB enum (additive migration; existing `TITLE_ESCROW` rows stay valid and keep the label "Title/Escrow"). The wizard sends the chosen type as the role and leaves `company` as typed. `PartiesTable` labels and the TS role type updated.

**#10 Pending Broker Review popup.** `Tooltip` wraps the **entire checklist row** and shows "Pending Broker Review" when the mouse is anywhere on it, for rows whose document is awaiting review. Popup is small, dark, appears just above the row's left end (over the status icon), no JavaScript. Other statuses show no popup.

**#12 Admin list links.** `FileCard` gets an optional `href`; the admin list passes `/admin/transactions/<type>/<id>` and the nested outer `<Link>` is removed. The list labels each file's type when merging listings and transactions (currently everything defaults to "listing", which is why clicks 404).

**#13 Sale price on cards.** Transactions show sale price (falling back to list price if none yet); listings show list price. One tested helper `pickDisplayPrice`, used by the admin list and the agent Transactions list.

**#18 Email wording.** "Correction Needed" and "All Documents Approved" emails hardcode "your listing". Use the real file type.

**#19 Tab from link.** The file page reads `?tab=` (checklist, commission, documents, tasks, parties, activity; default overview) so the "View Checklists" button opens the right tab.

**#23 Activity detail.** Feed shows the document name for upload/approve/reject and the rejection note for rejects, and only shows "from → to" when `from` exists.

**#24 Parties columns.** Add Company and License # columns.

**#25 Admin All Files.** New `GET /api/admin/files` (ADMIN only) returns every agent's listings and transactions with the agent's name and checklist data; the All Files tab uses it. Agent pages keep using the existing own-files routes.

## Testing
- Tests first for pure logic: `formatDateOnly` (run under a Pacific timezone so the bug reproduces), `pickDisplayPrice`, the wizard's escrow-type → role mapping, email wording, the new admin route (403 for non-admin, returns other agents' files).
- No component-render test infrastructure exists in this project, so on-screen items are verified with `tsc`, the full suite, and a live check in the browser.
- Before finishing: full test suite, `tsc --noEmit`, and a production `next build` (the dev server must be stopped first — asks Ryan before doing so).

## Risks
- The enum migration runs against the shared Neon database (local dev and production share it). It is additive (`ADD VALUE`), but it needs Ryan's explicit go-ahead at that step.
- Dates: any date-only field missed keeps the old behavior; the audit list above is the checklist.
