# Walkthrough fixes — Sub-project B: review, status and email flow

**Date:** 2026-09-21
**Origin:** Found during the live Purchase-transaction walkthrough (see sub-project A spec, `2026-09-20-walkthrough-fixes-a-design.md`).
**Scope:** how a file changes status, what is locked once it is finished, what happens when an email fails, and what the user sees when an action fails.
**Explicitly out:** input rules and the parties-required rule (sub-project C), commission redesign (D), the global form text color (#16), New Listing type cards (#5), pagination of the admin file lists.
**Already done in A:** a checklist row's status follows its newest uploaded document (`latestDocument`, commit 938a7e9). B only adds the rejection reason on top of that.

## Decisions made with Ryan

1. **Closed-file lock:** once a file is finished, the whole file is read-only for the agent (documents, parties, tasks, notes, conditions, field edits, submit, convert). Admin is exempt.
2. **Awaiting Review flag:** stays on until an admin changes the file's status. It does not clear when the last document is reviewed, because the broker may still need to check list price, commission and other tabs.
3. **Email failures:** never block or fail the action. Every failure is logged to Sentry. Only the person who performed the action sees a warning; agents never see one.

## Reuse audit (done before designing)

| Need | Already in the codebase? | Decision |
|---|---|---|
| Status-change logic | Written three times and they disagree: `PATCH api/transactions/[id]` and `PATCH api/listings/[id]` validate the move, log `from` and `to`, and send the Closed email, but skip the ready-to-close check and never clear Awaiting Review. `PATCH api/admin/files/[fileType]/[id]/status` validates, checks ready-to-close and clears Awaiting Review, but logs only `to` and sends no Closed email. | One shared function used by all three routes. |
| Allowed moves | `canTransitionListing` / `canTransitionTransaction` in `lib/transaction-helpers.ts` are backed by four private transition tables. The admin dropdown ignores them and lists every status. | Add `allowedNextStatuses` next to those tables so the dropdown and the server read the same source. |
| Ready to close | `isReadyToClose` exists and is used by the admin route and the approve route. | Reuse. |
| Closed-file lock | None. `PATCH` lets an agent change price, dates and commission on a closed file. There is a `PENDING_TRANSFER` lock in the UI only (`isLocked`), which is unrelated. | New server-side guard. |
| Email failure handling | None. `transaction-emails.ts` has no error handling and every route awaits sends inline. A bounced test address already caused a 500 after the database write. | New small `sendSafely` wrapper. |
| Error display on failed actions | `ReferralActions.patch()` in the file page checks `res.ok` and shows the server's message. Submit for Review, the admin status dropdown, Approve/Reject and Convert ignore the response. | Reuse that pattern; do not invent a second one. |
| Ownership check | `checkOwnership()` in `lib/api-auth.ts` is already used by the file routes. | The lock guard sits beside it and is called right after it. |
| Rejection reason | `rejectionNote` is already stored, returned to the browser, and shown on the admin card. The agent's checklist row shows only "Rejected — please re-upload". | Show the newest document's note on the agent row. |
| Spinner, tooltip, status badge | Exist from A. | Reuse. |

## Design

### 1. One shared status function

New file `apps/web/src/lib/file-status.ts` exports `changeFileStatus`.

Input: file kind (`listing` or `transaction`), file id, target status, and the actor (user id and role).
Result: either `{ ok: true, emailWarning?: true }` or `{ ok: false, status, error }`. Routes return that status and message directly.

Behavior, in order:
1. Load the file with its checklist items and documents. Not found returns 404.
2. Reject a move the transition tables do not allow (400, "Cannot transition from X to Y").
3. If the target is `CLOSED`, reject unless `isReadyToClose` (400, "Cannot close: not all required documents are approved"). This now applies to every path, including the `PATCH` routes.
4. Update the status. If the actor is an admin, set `awaitingReview` to false in the same update. An agent's status change never clears it.
5. Write the activity entry with both `from` and `to`.
6. If the target is `CLOSED`, send the Closed email through `sendSafely`.

Validation (steps 1 to 3) always happens before any write. The `PATCH` routes run their own field validation first, then call `changeFileStatus` for the status part, so a rejected status change never leaves half-saved fields.

The three routes become thin: authenticate, check ownership, apply the lock, call the function, return its result.

`allowedNextStatuses(kind, from, role)` is added to `lib/transaction-helpers.ts`. It returns the moves the existing tables allow. The admin dropdown shows the current status plus these; nothing else.

### 2. Closed-file lock

New file `apps/web/src/lib/file-lock.ts`:
- `isFileLocked(kind, status)` is a pure function. Locked statuses:
  - Transactions: `CLOSED`, `ARCHIVED`, `CANCELED_APPROVED`.
  - Listings: `CLOSED`, `CANCELED`. Ryan named Archived and Canceled Approved, which exist only on transactions; `CANCELED` is the listing equivalent because it is terminal for everyone (no transitions out of it). `WITHDRAWN` and `EXPIRED` stay editable because an admin can reactivate them.
- `assertFileEditable(...)` returns a 403 response with "This file is closed and can't be changed" when the actor is an agent and the file is locked. It returns nothing for admins.

It is called right after `checkOwnership` in every route an agent can use to change a file:

- `POST api/documents`, and delete or update in `api/documents/[id]`
- `GET api/upload-url` (the upload URL request)
- `POST api/file-tasks`, and `api/file-tasks/[taskId]`
- `POST api/files/[fileType]/[id]/note`
- `api/files/[fileType]/[id]/parties` and `.../parties/[partyId]`
- `api/transactions/[id]/conditions`
- `PATCH api/transactions/[id]` and `PATCH api/listings/[id]`
- `POST api/transactions/[id]/submit-review` and `POST api/listings/[id]/submit-review`
- `POST api/listings/[id]/convert`

Read-only routes (`GET`, document download) are not guarded. The `PENDING_TRANSFER` unlock in the approve route is admin-only and unaffected.

On screen, when the file is locked and the viewer is not an admin: the Upload and Add Document buttons are greyed out, Submit for Review and Convert are hidden, the add and delete controls on Parties, Tasks and Conditions are hidden, the note box is disabled, and a single line reads "This file is closed." The UI hides what the server would refuse; the server is the real lock.

### 3. Emails never block an action

New file `apps/web/src/lib/email/send-safely.ts` exports `sendSafely(send)`. It awaits the send in a try/catch. On failure it calls `Sentry.captureException` with the error and returns `{ failed: true }`; on success it returns `{ failed: false }`. It never throws.

Used at every file-status email call site: the Closed email (both `PATCH` routes and the admin route, through `changeFileStatus`), submit-for-review (both routes), document rejected, and all-documents-approved.

Where the action was done by an admin, the route includes `emailWarning: true` in its JSON. The admin file page shows "Saved, but the email to the agent couldn't be sent." next to the status control; `DocumentReviewCard` shows the same after Approve or Reject. When the actor is an agent (submit for review), the failure is only logged; no warning is returned or shown.

### 4. Errors and the rejection reason on screen

- Submit for Review (agent file page), the admin status dropdown, `DocumentReviewCard` Approve and Reject, and Convert to Transaction each check `res.ok` and show the server's `error` inline, following `ReferralActions`. Loading spinners already exist from A and stay.
- The agent's checklist row for a rejected document shows the newest document's `rejectionNote` under "Rejected — please re-upload" (red, small), using `latestDocument`.

## Testing

Test-first for everything with logic:
- `file-status`: each rejected path (bad transition, not ready to close, not found) writes nothing; admin success clears Awaiting Review; agent success does not; activity has `from` and `to`; Closed sends the email; an email failure still returns success with `emailWarning`.
- `allowedNextStatuses`: matches the existing tables for agent and admin, for both file kinds.
- `file-lock`: every locked and unlocked status for both kinds; agent gets 403 and admin passes, on each guarded route (one test per route family is enough where routes share code).
- `sendSafely`: returns failed on throw, logs to Sentry, never throws.
- Existing route tests are updated where behavior changes on purpose (the `PATCH` routes now enforce ready-to-close and the lock).

The screens are verified with `tsc`, a full test run, a clean production `next build`, and a live check with Ryan against the walkthrough file (Closed and Awaiting Review), as in A.

## Risks

- **Behavior change on `PATCH`:** agents and admins can no longer close a file through the `PATCH` routes without all required documents approved. This matches what the admin route already required. Checked in the code: the only screen that closes through `PATCH` is the referral screen (`ReferralActions`, "Close" step), and the seeded referral template's one item (RFA) is `isRequired: false`, so `isReadyToClose` is true for referral files and they keep closing. If a broker ever marks the RFA item required in the template editor, referral files would then need it approved before closing; that is consistent with every other file type. The referral lifecycle tests must stay green.
- **Lock coverage:** a route missed in the list above would leave a hole. The plan includes a step that greps every route touching a file for the guard.
- **Shared database:** the live check uses the walkthrough file; no schema change is needed, so no migration.
