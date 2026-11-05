# Awaiting Review: auto-clear, commission approval, and agent status block — design

Date: 2026-11-04. Covers listings AND transactions, agent AND admin, desktop AND phone.

## Why

Ryan approved every checklist document on Foster Road and the yellow **Awaiting Review** badge stayed. Today the
flag (`awaitingReview` on `ListingFile` / `TransactionFile`) clears only when an admin changes the file's status
(`changeFileStatus`, `lib/file-status.ts`). That was deliberate (spec `2026-09-21-walkthrough-fixes-b-design.md`):
the broker might still be checking price and commission. In practice Ryan checks the other file details before
approving the last document, so the badge should fall off by itself.

Two follow-on gaps came out of the discussion:

1. Commission is locked while a file awaits review (`isCommissionLockedFor`, `lib/file-lock.ts`). Once the badge
   clears, an agent can change the commission and nothing tells Ryan.
2. While a file awaits review, the agent can still change its status (the status dropdown and the server both
   allow it). Ryan wants nothing to move forward while something is waiting on him.

SkySlope was the reference: per-document review, a separate broker approval for price/commission, broker
approval for cancellations, admin-only reactivation of withdrawn files.

## Goals

- The badge clears automatically when the last required checklist document is approved.
- An agent's commission change after review comes back to Ryan as a change he approves or rejects.
- While a file awaits review, the agent cannot change its status, except to get out of the deal.
- No new database work on any page load. Ryan's admin page is never blocked.

## Non-goals

- No lock/unlock commission button (Ryan rejected it).
- No change to how Withdrawn works (stays immediate, agent can't undo, admin can reactivate).
- No change to automatic status changes.
- Additional (non-checklist) documents never affect the badge.

## Anti-goals (a failure even if it works)

- A pending commission change silently approved by some other action.
- An agent blocked from cancelling/withdrawing a deal because it is under review.
- Automatic status changes (morning expiration job, auto-Pending, listing following its transaction) stopping
  because the file is under review.
- Any desktop layout change beyond the agreed pieces, or a slower dashboard.

## Decided behaviour

### 1. Badge auto-clear

- When an admin approves a checklist document (`/api/admin/documents/[id]/approve`, shared by listings and
  transactions) and every required checklist item on that file is now approved (`isReadyToClose`), set
  `awaitingReview = false` — **unless a commission change is pending** (section 2). The route already computes
  `isReadyToClose` and loads the file record in that branch for the "all approved" email; reuse it.
- Approving an additional document never clears it (the route already distinguishes `checklistItemId`).
- Rejecting a document leaves the badge on; the file stays in review until the replacement is approved.
- An admin status change still clears the flag (existing rule), **except while a commission change is pending** —
  then the flag stays and the change still needs Approve/Reject.
- **Nothing left to review → no flag.** If an agent submits for review when every required checklist item is
  already approved and no commission change is pending (Ryan approved documents before submission, or the agent
  resubmits after the badge cleared), `submit-review` does not set the flag and tells the agent everything is
  already approved. Otherwise the flag would turn on with no approval left to clear it.

### 2. Commission

Commission fields: listing `commissionPercent`, `commissionAmount`; transaction `saleCommissionPct`,
`saleCommissionAmount`, `listingCommissionPct`, `listingCommissionAmount` (the lists in `lib/file-edit.ts`).

- **Before the file is first submitted for review:** agents edit freely, as today.
- **While awaiting review:** agents cannot edit (existing `commissionLockedError` + hidden pencil). The row shows
  the text "Waiting for broker review" instead of nothing.
- **After review (submitted at least once, badge now off):** an agent's commission save is accepted — the new
  values are saved to the file — and the file goes back to Awaiting Review with a **pending commission change**
  that stores the previous values of the changed commission fields.
  - Needs new storage on both `ListingFile` and `TransactionFile` (migration) for the previous values, and a way
    to know the file has been submitted before. Shape is the builder's call.
  - The Activity log keeps recording the change as today (`COMMISSION_CHANGED`, `lib/commission-log.ts`).
  - **Email to Ryan (decided by Ryan):** new transactional email to the broker (`BROKER_EMAIL`), sent after the
    save. Built like `sendCancellationRequested` in `lib/email/transaction-emails.ts` (`buildHeadingBodyHtml` +
    `emailLayout` + `sendEmail`). Heading **"Commission Change Request"**; body: agent name, "changed the
    commission on a listing/transaction file", property, and the **exact old → new values** (one line per changed
    field, reusing the `commissionChanges` output the save already computes — no extra query); button "Review
    Change" → the admin file page. One email for listings and transactions. Live test to
    ryanchong@cncrealtygroup.com after building.
  - **Email photo (decided by Ryan):** `C:\Users\hey_r\Downloads\pexels-tima-miroshnichenko-6693655.jpg`
    (5979×3986), cropped and saved like the other email photos in `apps/web/public/` (e.g.
    `submit-review-photo.jpg`: 2400×693 JPEG, ~110–160 KB). Crop: **full width**, the strip centered top-to-bottom
    on the calculator and cash (Ryan's "Option A"); the laptop may be partly cut, the group sits left of center.
- **What Ryan sees** (admin file page, Overview commission row): the change as "2.5% → 2%" (one line per changed
  field, display format from `commissionChanges`) with **Approve** and **Reject** buttons — only those two.
  - Extract the green Approve / red Reject + required-reason textarea + Cancel / "Confirm Reject" from
    `DocumentReviewCard.tsx` into one shared component; the checklist card and the commission row both use it.
    The checklist's look and behaviour must not change.
- **Approve:** keeps the new values, clears the pending change, clears the badge (if no required document is
  still unapproved), logs it in Activity.
- **Reject (reason required):** restores the stored previous values, clears the pending change, clears the badge
  (same condition), logs it in Activity, and emails the file's agent the reason. New template via `emailLayout()`
  in `lib/email.ts`; send a live test to ryanchong@cncrealtygroup.com after building it.
- **What the agent sees while pending:** the new number on the commission row with "Waiting for broker review",
  pencil hidden.
- **Admin editing commission:** never creates a pending change. If a change is pending, an admin's own commission
  save resolves it (treated as Approve of whatever the admin saved).

### 3. Agent status block while Awaiting Review

Applies whenever `awaitingReview` is true, whether from documents or a pending commission change. Agents only;
admins unaffected.

- **Status dropdown** (agent file page, `FileStatusSelect`): offers only the exit option — **Request
  Cancellation** on transactions, **Withdrawn** on listings — where the normal transition rules allow it. If none
  is allowed, the dropdown is disabled. A visible "Waiting for broker review" message explains it (must show on
  phones — the shared `Tooltip` is hidden below 1024px, so it can't be the only carrier).
- **Convert to Transaction:** blocked for agents with the reason "Waiting for broker review", using the existing
  `ConvertListingButton` `blockedReason` + `convertBlockedReason` path. The admin page uses the same helper and
  must stay unblocked.
- **Server:** `changeFileStatus` refuses an agent's status change while `awaitingReview` is true (400), except
  `CANCELED_PENDING` (transactions) and `WITHDRAWN` (listings). The convert route refuses agents likewise.
- **Automatic changes are never blocked.** `maybeAutoPending` calls `changeFileStatus` with an AGENT actor
  (logged `automatic: true`); the guard must exempt it. `writeAutoStatus` (morning job, `followDates`) and the
  listing-follows-transaction sync don't go through the guard already.
- Withdrawn and Request Cancellation keep their current behaviour (Withdrawn immediate; cancellation goes to Ryan).

### 4. "Stuck" flags

Earlier finding: a listing can change status without clearing the flag (convert, automatic expiration, listing
updated when its transaction closes/cancels), so a file could sit in the review queue forever. With section 1's
auto-clear, the flag still clears when Ryan approves the last document, so those files are no longer stuck. No
extra clearing on those paths, with one exception: **an admin's Convert clears the flag** like any admin status
change (same pending-commission exception). A flagged listing that expires keeps its flag; the agent can't move it
back to Active until review is done — consistent with section 3.

## Constraints

- Desktop layout unchanged except: the "Waiting for broker review" message, the limited status dropdown, the
  commission-row pending display + Approve/Reject. **Ask Ryan where the message and the pending display go before
  building any UI.**
- Reuse shared pieces: `FileStatusSelect`, `ConvertListingButton`/`convertBlockedReason`, `OverviewTab`'s
  commission row, the extracted Approve/Reject component, phone class bundles in `lib/dashboard-phone.ts`.
- Speed (measured 2026-11-04, read-only): page loads gain no queries (flag + pending values are on the file row
  already loaded); the status guard uses the file `changeFileStatus` already loads; approve route adds one small
  write only on the last approval; an agent commission save needs no extra lookup (the marker and flag are on the
  file the save route already loads); `submit-review` already loads the checklist. Re-check touched pages after building: one desktop + one phone size, numeric only.
- TDD; full suite + `tsc` + production build before claiming done.
- Local dev and production share one Neon DB: the migration is live the moment it runs.

## Builder's calls (decided by Claude, Ryan to check)

1. "After review" = the file has been submitted at least once and the flag is off (normally because all documents
   were approved, or Ryan changed the status). The save route checks the "submitted before" marker and the flag,
   not the checklist.
2. An admin status change or admin Convert does not clear the flag while a commission change is pending.
3. An admin's own commission save resolves a pending change.
4. (Withdrawn — Ryan chose to get an email; see section 2.)
5. A flagged listing that auto-expires keeps its flag.
6. Submitting when everything is already approved sets no flag (section 1).
7. Reject recomputes dollar amounts / gross commission from the restored values the same way a normal commission
   save does.
8. An agent may still Withdraw a listing with a pending change; Ryan can still Approve/Reject it afterwards
   (a Withdrawn listing is not locked).

## Finishing a file while a commission change is pending (decided by Ryan)

Admin **Close**, admin **Cancel-approve** (`CANCELED_APPROVED`) and admin **Convert** are refused until Ryan approves
or rejects the change, with the message "Approve or reject the commission change first". Precedent: Close is already
refused until every required document is approved (`isReadyToClose`), for admins too. Without this, a Convert would
copy the agent's unapproved numbers into the new transaction, and a Reject after Close would rewrite and email about
a finished deal. All other admin status changes stay allowed.

## Left to the builder

Storage shape for the pending change and the "submitted before" marker; Activity type names for approve/reject;
API route shape for commission approve/reject; how the dropdown filters its options; email wording (Ryan reviews
it via the live test).
