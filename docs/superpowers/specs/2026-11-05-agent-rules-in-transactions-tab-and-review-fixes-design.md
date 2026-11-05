# Agent rules in the Transactions tab + Awaiting Review fix round — design

Date: 2026-11-05. Follows `2026-11-04-awaiting-review-commission-and-status-design.md` (built, not yet pushed).
Covers listings AND transactions, agent AND admin, desktop AND phone.

## Why

1. Ryan's rule: **his Agent section behaves like any other agent's; admin rights apply only in the Admin-section
   tabs.** The 2026-09-29 personal-views decision covered whose data shows. Permissions on the agent file page
   (`app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`) and the file API routes still follow the
   session role, so an admin gets admin powers there. That started with closed-file read-only (ab7fd381, 9/21) and
   the commission lock (e13916c4, 9/26), and the 11/04 build followed the same pattern. Ryan wants to experience
   both sides of the process: as an agent on his own files, and as broker in the Admin tabs.
2. The 11/04 build's final review left small items. Ryan picked which ones to fix.
3. One wording change in the rejection email.

## Goals

- In the **Agent section → Transactions tab** (file list + listing/transaction file pages), an admin is treated
  exactly like an agent, on screen and on the server. This applies to Ryan and to any future admin.
- The chosen small items are fixed, with tests.
- No extra database queries on any page load. No slower pages. No new Neon cost.

## Non-goals

- **No change to any other Agent-section tab.** Newsletter list, "send to newsletter", the Academy announcement
  writer, Leads, Pipeline, Tasks and Campaigns stay as they are. Opening any agent's lead from Admin → All Leads
  (via the agent lead page) stays as it is.
- No change to Admin-section pages or `/api/admin/*` routes, except the referral broker steps that move onto the Admin
  file page (Part 1, "Referral broker steps").
- **Review emails stay at info@cncrealtygroup.com** (`BROKER_EMAIL`). Info@ is a Hostinger alias of Ryan's mailbox
  today. When another admin is added, Ryan will turn info@ into its own mailbox in Hostinger; the code doesn't
  change.

## Anti-goals (a failure even if it works)

- An admin losing any power on the Admin-section pages.
- Anyone gaining rights through the new marker. It may only reduce rights, never add them.
- A slower dashboard or file page, or more Neon queries.
- Any desktop layout change beyond hiding the admin-only controls listed below.

## Part 1 — Agent rules in the Transactions tab

### Decided behaviour

When an admin uses the Transactions tab on their own files, everything works as for an agent:

- **Status dropdown:** agent transitions only (`AGENT_*_TRANSITIONS`). While a file awaits review, only the exit
  status (Withdrawn / Request Cancellation) with "Waiting for broker review" under it.
- **Convert:** blocked while awaiting review ("Waiting for broker review").
- **Commission:** locked while awaiting review. After review, their own edit creates a pending commission change.
  The file goes back to Awaiting Review and the Commission Change Request email goes to info@, exactly as for any
  agent (Ryan's decision). The admin then approves or rejects it on the Admin file page.
- **Submit for review:** the same as an agent's, including the File Ready for Review email.
- **Closed/canceled files:** read-only (`isFileReadOnlyFor` / `assertFileEditable` with the agent role).
- **Pending readiness and listing Active/Coming Soon rules** in `changeFileStatus` apply (the `actor.role !==
  "ADMIN"` checks).
- **Documents:** remove only their own uploads that are still in review (`documents/[id]/remove`).
- **Hidden on the agent page:**
  - Change representation (`canChangeRepresentation`). It is already on the Admin file page.
  - The referral broker steps (`ReferralActions` branches gated by `viewerIsAdmin`). These move to the Admin file
    page (below).
- **Pending commission display:** the agent view ("new number + Waiting for broker review"). This replaces the
  current admin-on-agent-page look (pending lines without buttons).
- **Activity log:** actions taken in the Transactions tab are logged with the agent role (builder's call 1).

### Referral broker steps move to the Admin file page (found by the builder check)

Today the two broker steps for a referral exist only on the agent file page, shown when the viewer is an admin:
- the "amount received" box. It moves the file to Referral Broker Review, and the PATCH route works out
  `referralCncFee`.
- "Mark Closed".

The Admin file page has neither. Its status dropdown can set Referral Broker Review, but it never sends an amount, so
the fee is never calculated. Hiding the steps from the agent page without moving them would leave no way to finish a
referral. (The July referral test passed because it ran on the agent page with admin rights.)

- Move the admin branches of `ReferralActions` onto the Admin file page. Reuse the same component (extract or share
  it; no new UI). Put them where they sit on the agent page today: in the header, next to the status control (Ryan:
  keep the current spot).
- These saves come from the Admin page, so they carry no marker and run with admin rights.
- On the Admin page, Referral Broker Review must only be reachable through the amount step, so the fee is always
  calculated. The status dropdown must not offer it on its own.
- The agent's own referral steps stay on the agent page unchanged.
- Admin account only. Agents never see the broker steps, the same as today.

### Safety net: another agent's file opened in the agent section

Nothing in the site links an admin to another agent's file in the agent section. All Files, deadline alerts,
Pipeline and the Transactions list all go to the admin's own files or to the Admin page, and agent-page email links
go only to that file's agent. A hand-pasted link could still get there. If the viewer is an admin and the file's agent
is not them, the agent file page sends them to the matching `/admin/transactions/...` page. No extra query: the page
already loads `agentId`.

### Server: how a request says "agent rules"

The server can't tell which tab a request came from. Requests sent from Transactions-tab pages carry a marker
saying "apply agent rules". Admin pages never send it.

- One shared server helper turns the session plus the request into the acting role:
  - `AGENT` if the session is AGENT;
  - `AGENT` if the session is ADMIN and the marker is present;
  - otherwise `ADMIN`.

  It never returns ADMIN for an AGENT session.
- Every file route the Transactions-tab pages call uses this helper wherever it uses the session role today:
  - `api/listings/[id]` PATCH;
  - `api/transactions/[id]` PATCH;
  - `api/listings/[id]/convert`;
  - `api/listings/[id]/submit-review` and `api/transactions/[id]/submit-review`;
  - `api/files/[fileType]/[id]/note`;
  - `api/files/[fileType]/[id]/parties` (and its `maybeAutoPending` actor);
  - `api/documents` (upload);
  - `api/documents/[id]/remove`;
  - the Pending Transfer panel's route;
  - the file-tasks routes.

  The builder confirms this list against the page's actual calls.
- Ownership checks (`checkOwnership`) also use the acting role, so an admin acting as agent can only touch files
  where they are the agent.
- Client side: one shared way to send the marker. The agent file page and every shared component it renders that
  writes data must use it: `ConvertListingModal`, `PartiesTable`, `ActivityFeed`, the documents/checklist upload
  and remove controls, `TransferPendingPanel`, and the file-task calls. Shared components that the Admin file page
  also renders must not send the marker there.
- Server-rendered agent page: compute permissions with the role `"AGENT"` instead of the session role (the
  `viewerIsAdmin` and `session.user.role` uses at lines ~202–208, 264, 276, 364–365). `canEditDetails` stays as it
  is (it already checks that the viewer is the file's agent).

### Speed / cost

The role comes from the session; the marker is a request header or field. No new queries, no new writes.

## Part 2 — Fix round (Ryan's picks from the 11/04 deferred list)

Numbers match the list Ryan approved.

1. **Double-click / Reject vs Approve race:** `resolveCommissionChange` saves only if the same pending change is
   still there (match on its `requestedAt`, in the update's `where`). If it's already gone, return 409 "This change
   was already decided". No second email or Activity row.
2. **Activity write failure:** the decision's update and its Activity row are written in one database transaction.
   The email is sent after the transaction succeeds; an email failure returns `emailWarning`, which the Admin page
   already shows.
3. **Admin save clearing the badge via auto-Pending:** already fixed (`file-status.ts` skips the admin flag clear
   for `automatic`), with a test. No work.
4. **Convert button re-enabling:** in the shared `ConvertListingModal`, the button stays disabled after a
   successful convert until the page navigates.
5. **Blank or non-object body** to `api/admin/files/[fileType]/[id]/commission-review`: 400, not 500.
6. **Impossible numbers (Ryan: every commission save):** one shared check refuses NaN/Infinity on every commission
   save, whether it comes from an agent or an admin, before or after review, including the admin save that resolves a
   pending change. The save is refused with a 400 before anything is stored. Today the values are parsed with plain
   `parseFloat` in `lib/file-edit.ts`, so the check belongs in that shared parsing, not only in
   `buildPendingCommission`.
7. **Agent with no login account / no email** on reject: report to Sentry and return `emailWarning`.
8. **Reject reason clears on Cancel:** already true for both the checklist and the commission row (shared
   `RejectReasonForm` unmounts). Add a test that pins it for `DocumentReviewCard` and `CommissionReviewBlock`.
9. **Reject toggle while busy:** in the shared `ApproveRejectButtons`, Reject is disabled while a save is running.
10. **Button type:** all buttons in `ApproveReject.tsx` get `type="button"`.
11. **Change lines built twice:** one shared helper in `lib/email/transaction-emails.ts` builds the old → new lines
    for both emails.
12. **Duplicated test setup:** shared fixtures for the two submit-review test files and the duplicated COMPLETE
    fixtures in `file-status.test.ts`. Use an existing test-helper location if there is one.
13. **Type cycle:** `PendingCommission` / `CommissionChange` move to the types layer (`types/transaction.ts` or a
    sibling), and `lib/commission-review.ts` imports them from there.
14. **Agent account query:** `resolveCommissionChange` loads only the agent user's name and email, not the full
    User row.
15. **Indentation:** re-indent the status-dropdown wrapper on the agent file page (code only; no visual change).

### Rejection email wording

`sendCommissionChangeRejected` body line becomes:

> Hi {agent name}, your commission change on **{address}** was not approved.

(Drop ", so the commission is back to what it was.") The change lines and the reason stay. After this change, send
a live test to ryanchong@cncrealtygroup.com (standing rule).

### Missing tests to add (they cover code that already works)

- `buildPendingCommission("transaction")`.
- `isAfterReview` with `awaitingReview` undefined.
- A transaction with a pending commission (approve route badge rule).
- An agent refused a non-exit status on a transaction; a pending-but-unflagged file for an agent.
- Reject restores a flat-dollar commission and a lease commission; the transaction Activity row.
- Email escaping in change lines; apostrophe in the greeting; exact rejection subject; listing "View File" link.
- Phone width without the badge: numeric layout check only (no pixel sweep), touched page only.

## Constraints

- Reuse shared pieces. No new UI components; changes go into `ApproveReject.tsx`, `ConvertListingModal`,
  `OverviewTab`/`CommissionReviewBlock`, and the existing lock/status helpers.
- TDD. Full suite + `tsc` + production build before claiming done.
- Speed: one desktop + one phone numeric check of the agent and admin file pages. They must not be slower.
- No migration needed.
- Ask before every push.

## Builder's calls (Claude, Ryan to check)

1. Transactions-tab actions are logged with the agent role in Activity.
2. Marker shape (header vs body field) and the helper's name are left to the builder. It must be one shared helper
   on each side.
3. Item 1 matches on `requestedAt` rather than adding a version column (no migration).
4. The admin-commission-save-resolves-pending path in the PATCH routes stays. It is still reachable by an admin
   request without the marker, and it's harmless.
