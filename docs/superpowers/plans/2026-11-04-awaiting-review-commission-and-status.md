# Awaiting Review, Commission Approval & Agent Status Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Awaiting Review badge clears on the last document approval; an agent's commission change after review comes back to the broker to approve or reject (with emails); agents can't change a file's status while it awaits review, except to exit the deal.

**Architecture:** Two new columns per file (`reviewSubmittedAt`, `pendingCommission`) hold the review state on the row every page already loads. Pure rules live in `lib/commission-review.ts`; the DB side effects shared by both save routes live in `lib/commission-review-db.ts`. The status block sits in the one status function (`changeFileStatus`) plus the convert route, and the UI only mirrors those rules.

**Tech Stack:** Next.js 14 App Router, Prisma 5 / Neon Postgres, Vitest (node env, `.test.ts` only), Postmark via `lib/email/send.ts`, sharp.

**Spec:** `docs/superpowers/specs/2026-11-04-awaiting-review-commission-and-status-design.md`

## Global Constraints

- Covers listings AND transactions, agent AND admin, desktop AND phone. Admin page is never blocked except the three finishing actions below.
- Exact copy: `"Waiting for broker review"` · `"Approve or reject the commission change first"` · email heading `"Commission Change Request"` · email button `"Review Change"`.
- Agent exit statuses allowed during review: transactions `CANCELED_PENDING`, listings `WITHDRAWN`.
- Finishing actions refused (any role) while a commission change is pending: status `CLOSED`, `CANCELED_APPROVED`, listing `CANCELED`, and Convert. (Listing `CANCELED` is included because it finishes a listing the same way — ruling, cost if wrong: Ryan can't cancel a listing until he decides the change.)
- Commission fields: listing `commissionPercent`, `commissionAmount`; transaction `saleCommissionPct`, `saleCommissionAmount`, `listingCommissionPct`, `listingCommissionAmount`.
- Automatic status changes are never blocked (`maybeAutoPending`, `writeAutoStatus`, listing↔transaction sync).
- Additional documents never affect the badge.
- No new query on any page load. Desktop changes only where this plan says.
- Local dev and production share one Neon DB: the migration is live when it runs. Never run the full seed.
- Every task: `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`. Tasks 9 and 11 also run a clean production build (`rm -rf apps/web/.next && pnpm --filter web build`) with the dev server stopped — ask Ryan before stopping/restarting it.

## Review Focus

1. Agent edits only the **price** on a %-commission file after review → `$` amounts recompute but the displayed commission is unchanged → **no** re-flag, no email. (Task 6 test.)
2. Ryan cleared the badge with a status change while documents were still unapproved, then the agent changes commission → re-flag; after Approve the badge **stays** (documents still unapproved). (Task 8 test.)
3. Reject on a transaction with a % commission → restored % and recomputed `$` amounts and `commissionGCI` match a normal save. (Task 8 test.)
4. `maybeAutoPending` on a flagged transaction still moves it to Pending. (Task 4 test.)
5. An agent PATCH that sends commission **and** status in one request on a file not yet flagged → status applies, then the file re-flags. (Task 6 test — ruling: the UI never sends both; the guard reads the flag as it stood before the request.)

---

### Task 1: Schema, migration, and pure review rules

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (ListingFile ~line 495, TransactionFile ~line 559, `enum FileActivityType` line 182)
- Create: `packages/database/prisma/migrations/20261104120000_commission_review/migration.sql`
- Modify: `apps/web/src/types/transaction.ts` (both file detail types, next to `awaitingReview`)
- Modify: `apps/web/src/lib/file-edit.ts` (export `LISTING_COMMISSION`, `TX_COMMISSION`)
- Create: `apps/web/src/lib/commission-review.ts`
- Test: `apps/web/src/__tests__/lib/commission-review.test.ts`

**Interfaces:**
- Produces:
  - DB: `reviewSubmittedAt DateTime?`, `pendingCommission Json?` on both file models; enum values `COMMISSION_CHANGE_APPROVED`, `COMMISSION_CHANGE_REJECTED`.
  - `type CommissionChange = { label: string; from: string; to: string }`
  - `type PendingCommission = { before: Record<string, number | null>; changes: CommissionChange[]; requestedAt: string }`
  - `commissionFields(kind: "listing" | "transaction"): readonly string[]`
  - `buildPendingCommission(kind, before: Record<string, unknown>, changes: CommissionChange[], now: Date): PendingCommission`
  - `isAfterReview(file: { reviewSubmittedAt?: Date | string | null; awaitingReview?: boolean | null }): boolean`
  - `canClearReview(items: FileChecklistItemWithDocs[], pendingCommission: unknown): boolean` — `isReadyToClose(items) && !pendingCommission`

- [ ] **Step 1: Write the failing tests** in `commission-review.test.ts`:
  - `commissionFields("listing")` equals `["commissionPercent","commissionAmount"]`; `"transaction"` equals the four tx fields.
  - `buildPendingCommission("listing", { commissionPercent: 2.5, commissionAmount: null, city: "X" }, [{label:"Commission",from:"2.5%",to:"2%"}], new Date("2026-11-04T00:00:00Z"))` equals `{ before: { commissionPercent: 2.5, commissionAmount: null }, changes: [...], requestedAt: "2026-11-04T00:00:00.000Z" }` (non-commission keys dropped, missing keys → `null`).
  - `isAfterReview`: `{reviewSubmittedAt: null}` → false; `{reviewSubmittedAt: date, awaitingReview: true}` → false; `{reviewSubmittedAt: date, awaitingReview: false}` → true.
  - `canClearReview(allApprovedItems, null)` → true; `(allApprovedItems, {before:{},changes:[],requestedAt:"x"})` → false; `(oneRequiredPendingItems, null)` → false.
- [ ] **Step 2:** Run `pnpm --filter web test commission-review` → FAIL (module not found).
- [ ] **Step 3:** Add the schema fields + enum values. Write the migration SQL by hand: `ALTER TABLE` add both nullable columns on both tables, `ALTER TYPE "FileActivityType" ADD VALUE` ×2, and backfill `reviewSubmittedAt` from the earliest `SUBMITTED_FOR_REVIEW` activity per file (`UPDATE "ListingFile" f SET "reviewSubmittedAt" = a.min FROM (SELECT "listingFileId", MIN("createdAt") min FROM "FileActivity" WHERE type='SUBMITTED_FOR_REVIEW' GROUP BY 1) a WHERE a."listingFileId" = f.id;` and the same for transactions). Apply with `pnpm --filter @cnc/database exec prisma migrate deploy` then `prisma generate` (stop nothing — if generate hits EPERM, report to Ryan and ask before stopping the dev server). Add the two fields to both TS file types. Implement `lib/commission-review.ts`.
- [ ] **Step 4:** Run the tests → PASS. Confirm Foster Road (`cmvivu9290001n3iejhf2jtap`) now has a non-null `reviewSubmittedAt` with a read-only query.
- [ ] **Step 5: Commit** `feat: commission review columns and rules`.

---

### Task 2: Submit for Review records the submission and skips when nothing is left

**Files:**
- Modify: `apps/web/src/app/api/listings/[id]/submit-review/route.ts`, `apps/web/src/app/api/transactions/[id]/submit-review/route.ts`
- Test: `apps/web/src/__tests__/api/listings-submit-review.test.ts`, `transactions-submit-review.test.ts`

**Interfaces:** Consumes `canClearReview`. Produces response `{ ok: true, alreadyApproved: true }` when nothing is left to review.

- [ ] **Step 1: Failing tests** (both routes):
  - submitting sets `reviewSubmittedAt` only when it was null (update data includes `reviewSubmittedAt: expect.any(Date)`; when already set, the key is absent).
  - every required item approved and `pendingCommission: null` → 200 `{ ok: true, alreadyApproved: true }`, no `awaitingReview: true` write, no `sendSubmitForReview` call, no `SUBMITTED_FOR_REVIEW` activity.
  - existing "flags and emails" test still passes when a required document is pending.
- [ ] **Step 2:** Run both test files → new tests FAIL.
- [ ] **Step 3:** Implement: after the existing "still need documents" check, `if (canClearReview(items, file.pendingCommission)) return NextResponse.json({ ok: true, alreadyApproved: true })`; otherwise the update writes `awaitingReview: true` plus `reviewSubmittedAt: new Date()` when null.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: submit for review records the submission, skips when all approved`.

---

### Task 3: Badge clears on the last approval

**Files:**
- Modify: `apps/web/src/app/api/admin/documents/[id]/approve/route.ts` (the `doc.checklistItemId && isReadyToClose(checklistItems)` branch, ~line 160)
- Test: `apps/web/src/__tests__/api/admin-documents-approve.test.ts`

- [ ] **Step 1: Failing tests:**
  - last required checklist document approved, file `pendingCommission: null` → `listingFile.update` (and, in a transaction case, `transactionFile.update`) called with `{ awaitingReview: false }`.
  - same but `pendingCommission` set → no `awaitingReview: false` write.
  - an additional document (`checklistItemId: null`) approved → no write.
  - a required item still pending → no write.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** In that branch, add `pendingCommission: true` to the existing `fileRecord` select and, when it is null, update the file's `awaitingReview` to false (before the email).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: Awaiting Review clears on the last document approval`.

---

### Task 4: Status rules during review (server)

**Files:**
- Modify: `apps/web/src/lib/file-status.ts`
- Modify: `apps/web/src/lib/file-lock.ts`
- Test: `apps/web/src/__tests__/lib/file-status.test.ts`, `apps/web/src/__tests__/lib/file-lock.test.ts`

**Interfaces:**
- Produces in `lib/file-lock.ts`:
  - `REVIEW_WAIT_MESSAGE = "Waiting for broker review"`, `PENDING_COMMISSION_MESSAGE = "Approve or reject the commission change first"`
  - `reviewExitStatus(kind: "listing" | "transaction"): string` → `"WITHDRAWN"` / `"CANCELED_PENDING"`
  - `isFinishingStatus(kind, toStatus: string): boolean` → listing `CLOSED`/`CANCELED`, transaction `CLOSED`/`CANCELED_APPROVED`
  - `statusOptionsDuringReview(kind, options: string[]): string[]` → `options` filtered to `reviewExitStatus(kind)`
- `ChangeFileStatusArgs` gains `automatic?: boolean`; `maybeAutoPending` passes `automatic: true` (keep `activityPayloadExtra: { automatic: true }`).

- [ ] **Step 1: Failing tests** in `file-status.test.ts`:
  - agent, `awaitingReview: true`, listing ACTIVE → COMING_SOON → `{ ok:false, status:400, error:"Waiting for broker review" }`, no update.
  - agent, flagged listing → WITHDRAWN → ok; flagged transaction → CANCELED_PENDING → ok.
  - agent actor with `automatic: true`, flagged transaction PRE_CONTRACT → PENDING → ok (`maybeAutoPending` path).
  - admin, `pendingCommission` set, transaction → CLOSED → 400 `"Approve or reject the commission change first"`; → CANCELED_APPROVED → same; listing → CANCELED → same; listing ACTIVE → COMING_SOON → ok and the update data has **no** `awaitingReview` key.
  - admin, no pending, flagged → any allowed status → update data has `awaitingReview: false` (existing behaviour kept).
  - `file-lock.test.ts`: the three helpers' outputs for both kinds.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** In `changeFileStatus`, right after the transition check: agent + `file.awaitingReview` + `!automatic` + `toStatus !== reviewExitStatus(kind)` → 400 `REVIEW_WAIT_MESSAGE`; any role + `file.pendingCommission` + `isFinishingStatus` → 400 `PENDING_COMMISSION_MESSAGE`. Admin clears the flag only when `!file.pendingCommission`. Extend `extraData` stripping to also drop `pendingCommission` and `reviewSubmittedAt`.
- [ ] **Step 4:** Run → PASS (also run `transactions-id.test.ts`, `listings-id-patch.test.ts`, `admin-files-status.test.ts`).
- [ ] **Step 5: Commit** `feat: agents can't change status while a file awaits review`.

---

### Task 5: Convert follows the same rules

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts` (`convertBlockedReason`, line 165)
- Modify: `apps/web/src/app/api/listings/[id]/convert/route.ts`
- Modify: both file pages' `convertBlockedReason(listing)` calls (`app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx:256`, `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx:185`)
- Test: `apps/web/src/__tests__/lib/transaction-helpers.test.ts`, `apps/web/src/__tests__/api/listings-convert.test.ts`

**Interfaces:** `convertBlockedReason(listing: {...existing, awaitingReview?: boolean | null; pendingCommission?: unknown }, role: "ADMIN" | "AGENT"): string | null` — order: existing reasons first, then `pendingCommission` → `PENDING_COMMISSION_MESSAGE` (any role), then agent + `awaitingReview` → `REVIEW_WAIT_MESSAGE`.

- [ ] **Step 1: Failing tests:** helper returns the two messages per the rule above and `null` for an admin on a flagged listing with no pending change; convert route: agent on flagged listing → 400 `"Waiting for broker review"`; admin on flagged listing → 201 and the listing update data includes `awaitingReview: false`; admin with pending change → 400 `"Approve or reject the commission change first"`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; the route passes the session role and adds `awaitingReview: false` to the listing's `ACTIVE_UNDER_CONTRACT` update when the actor is ADMIN. Pages pass `"AGENT"` / `"ADMIN"`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: convert waits for broker review`.

---

### Task 6: Commission emails and photo

**Files:**
- Modify: `apps/web/src/lib/email/transaction-emails.ts`
- Create: `apps/web/public/commission-change-photo.jpg`
- Test: `apps/web/src/__tests__/lib/transaction-emails.test.ts`

**Interfaces:**
- `sendCommissionChangeRequest(opts: { fileType: "Listing" | "Transaction"; address: string | null; agentName: string; fileId: string; changes: CommissionChange[]; to?: string }): Promise<void>` — to `BROKER_EMAIL`, transactional; heading `"Commission Change Request"`; photo `${NEXTAUTH_URL}/commission-change-photo.jpg`; body `"<strong>{agent}</strong> changed the commission on a {listing|transaction} file."`, `Property: <strong>{address}</strong>`, then one line per change `"{label}: {from} → {to}"`; CTA `"Review Change"` → `${NEXTAUTH_URL}/admin/transactions/{fileType lower}/{fileId}`; subject `"Commission Change Request — {address}"`.
- `sendCommissionChangeRejected(opts: { agentEmail: string; agentName: string; fileType: "Listing" | "Transaction"; address: string | null; fileId: string; reason: string; changes: CommissionChange[] }): Promise<void>` — to the agent, transactional; heading `"Commission Change Not Approved"`; photo `document-correction-photo.jpg` (existing — ruling: reuse the rejection-themed photo); body names the property, the reverted change(s) as `"{label}: {to} → {from}"`, and `Reason: <em>{reason}</em>`; CTA `"View File"` → `${NEXTAUTH_URL}/dashboard/transactions/{fileType lower}/{fileId}`.
- All user values escaped with `escapeHtml`; `address ?? NO_ADDRESS_LABEL`.

- [ ] **Step 1: Failing tests** mirroring the existing `sendCancellationRequested` tests: recipient, subject, heading text, each change line present, escaped `O'Brien` agent name renders once escaped (not double-escaped), CTA href, stream `"transactional"`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement both. Make the photo with a one-off `node -e` sharp call (no file kept): `sharp("C:/Users/hey_r/Downloads/pexels-tima-miroshnichenko-6693655.jpg").extract({ left: 0, top: 1529, width: 5979, height: 1726 }).resize(2400, 693).jpeg({ quality: 80, mozjpeg: true })` → `public/commission-change-photo.jpg`. Target 110–160 KB; adjust quality only. View the result image and confirm the calculator and cash sit in the vertical middle (Ryan's Option A: full width, laptop may be cut).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: commission change request and rejection emails`.

---

### Task 7: Commission saves after review come back to the broker

**Files:**
- Create: `apps/web/src/lib/commission-review-db.ts`
- Modify: `apps/web/src/app/api/listings/[id]/route.ts`, `apps/web/src/app/api/transactions/[id]/route.ts` (both PATCH branches — status-change branch and plain save — where `logCommissionChanges` is called)
- Test: `apps/web/src/__tests__/lib/commission-review-db.test.ts`; route tests `listings-id-patch.test.ts`, `transactions-id.test.ts`

**Interfaces:**
- Consumes Task 1 helpers, Task 6 `sendCommissionChangeRequest`.
- Produces `afterCommissionSave(kind, fileId: string, before: FileRow, after: FileRow, actor: { userId: string; role: "ADMIN" | "AGENT"; name: string | null }): Promise<void>` where `FileRow` is the saved file record (has commission fields, `awaitingReview`, `reviewSubmittedAt`, `pendingCommission`, `propertyAddress`, `transactionSide`). Rules:
  - `changes = commissionChanges(kind, before, after)`; empty → return.
  - AGENT and `isAfterReview(before)` → update file `{ awaitingReview: true, pendingCommission: buildPendingCommission(kind, before, changes, new Date()) }`, then `sendSafely(() => sendCommissionChangeRequest({...}))`.
  - ADMIN and `before.pendingCommission` → load checklist (`CHECKLIST_ITEMS_WITH_DOCS_INCLUDE`), update `{ pendingCommission: Prisma.DbNull, ...(isReadyToClose(items) && { awaitingReview: false }) }`, log `COMMISSION_CHANGE_APPROVED` with `{ changes: before.pendingCommission.changes, viaEdit: true }`.
  - Otherwise nothing.
- Routes call it right after each existing `logCommissionChanges(...)` call.

- [ ] **Step 1: Failing tests** (`commission-review-db.test.ts`, Prisma + email mocked):
  - agent, after review, `commissionPercent` 2.5 → 2 → one update with `awaitingReview: true` and `pendingCommission.before.commissionPercent === 2.5`; email called once with `changes[0].to === "2%"`.
  - agent, never submitted (`reviewSubmittedAt: null`) → no update, no email.
  - agent, after review, only `salePrice` changed on a %-commission transaction (amounts differ, % same) → no update, no email. *(Review Focus 1)*
  - admin with pending change, all required approved → update has `pendingCommission: Prisma.DbNull` and `awaitingReview: false`; activity `COMMISSION_CHANGE_APPROVED`.
  - admin with pending change, a required item unapproved → update has no `awaitingReview` key.
  - route test: agent PATCH `{ commissionPercent: "2", status: "COMING_SOON" }` on an after-review listing → 200, status applied, then re-flag update called. *(Review Focus 5)*
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and wire into both routes (pass `session.user.name`).
- [ ] **Step 4:** Run all touched test files → PASS.
- [ ] **Step 5: Commit** `feat: agent commission changes after review need broker approval`.

---

### Task 8: Approve / Reject API

**Files:**
- Create: `apps/web/src/app/api/admin/files/[fileType]/[id]/commission-review/route.ts`
- Modify: `apps/web/src/lib/commission-review-db.ts`
- Test: `apps/web/src/__tests__/api/admin-commission-review.test.ts`

**Interfaces:**
- `POST` body `{ decision: "approve" }` or `{ decision: "reject"; reason: string }`. Non-admin → 403; unknown `fileType` → 400 (match `admin/files/[fileType]/[id]/status`); file missing → 404; no pending change → 400 `"There's no commission change to review"`; reject with blank reason → 400 `"Please give a reason"`. Success → `{ ok: true, file }` (+ `emailWarning: true` if the reject email failed).
- Produces `resolveCommissionChange(kind, fileId, decision: { approve: true } | { approve: false; reason: string }, actor): Promise<ResolveResult>`:
  - approve: `pendingCommission: Prisma.DbNull`, clear flag if `isReadyToClose(items)`, activity `COMMISSION_CHANGE_APPROVED` `{ changes }`.
  - reject: restore `pending.before`; for a transaction recompute through `transactionCommissionEdit(pending.before, file)` so `$` amounts and `commissionGCI` match a normal save; listing writes the two fields directly. Same flag rule; activity `COMMISSION_CHANGE_REJECTED` `{ changes, reason }`; email the file's agent `sendCommissionChangeRejected`.

- [ ] **Step 1: Failing tests:** each error case above; approve clears pending and flag (all approved) / keeps flag (one unapproved — *Review Focus 2*); reject on a listing restores `commissionPercent: 2.5`; reject on a PURCHASE transaction with `saleCommissionPct` 2 → 3 and `salePrice` 500000 restores `saleCommissionPct: 3`, `saleCommissionAmount: 15000`, `commissionGCI: 15000` (*Review Focus 3*); reject sends one email with the reason; activity rows written.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: broker approves or rejects commission changes`.

---

### Task 9: Shared Approve / Reject buttons

**Files:**
- Create: `apps/web/src/components/ui/ApproveReject.tsx`
- Modify: `apps/web/src/components/transactions/DocumentReviewCard.tsx`

**Interfaces:**
- `ApproveRejectButtons({ busy: boolean; onApprove: () => void; onToggleReject: () => void })` — renders exactly the current green Approve (`CheckCircleIcon size={12}`) and red Reject (`XCircle h-3 w-3`) buttons as a fragment, same classes.
- `RejectReasonForm({ busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void })` — the current textarea (`"Rejection reason (required)"`) + Cancel + `"Confirm Reject"` (`"Saving…"` while busy), owns its own reason state, same classes.
- DocumentReviewCard renders them in the same places it renders the inline markup today.

- [ ] **Step 1:** No component render tests exist in this repo (node env); verification is pixel-level. Before changing anything, screenshot the admin Checklist tab of a file with a PENDING_REVIEW document at 1440 and 390 width, with the reject form open and closed (use an existing pf-survey screenshot script; if no pending document exists, ask Ryan before creating test data).
- [ ] **Step 2:** Extract the components; DocumentReviewCard keeps its fetch logic and state.
- [ ] **Step 3:** Re-screenshot the same four views → identical. Full suite + tsc + clean production build pass.
- [ ] **Step 4: Commit** `refactor: shared Approve/Reject buttons`.

---

### Task 10: Screens — commission row, status dropdown, convert, submit message

**Placement (confirm with Ryan at plan review; do not change without his OK):**
- Commission: a small block directly under the file's commission row(s) on the Overview, same card. Admin: one line per change `"{label}: {from} → {to}"` then `ApproveRejectButtons` (+ `RejectReasonForm` below when open). Agent: the same change lines then `"Waiting for broker review"`. Agent on a flagged file with no pending change: just `"Waiting for broker review"` under the commission rows.
- Status: agent page — `"Waiting for broker review"` as a small line directly under the status dropdown, plain text (not a tooltip), visible on phones.
- Submit: when the response has `alreadyApproved`, show `"Everything is already approved — nothing to review."` where the existing submit error/success text shows.

**Files:**
- Modify: `apps/web/src/components/transactions/OverviewTab.tsx` (new optional props), `app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`, `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`

**Interfaces:**
- `OverviewTab` new props: `pendingCommission?: PendingCommission | null`, `reviewWait?: boolean` (agent + flagged), `onCommissionReview?: (d: { approve: true } | { approve: false; reason: string }) => Promise<string | null>` (admin only; returns an error message or null). Admin page implements it with a POST to the Task 8 route, then reloads the file.
- Agent page: `const statusChoices = file.awaitingReview ? statusOptionsDuringReview(kind, statusOptions) : statusOptions;` the select is `disabled` when `file.awaitingReview && statusChoices.length === 0`; the wait line renders when `file.awaitingReview`.

- [ ] **Step 1:** Implement. Use `max-lg:`/`PHONE_*` bundles from `lib/dashboard-phone.ts` only if a phone layout needs it.
- [ ] **Step 2:** Live check on the dev server with Foster Road (set and reset state with read-only-verified DB updates, restoring the original values afterwards): agent view flagged → dropdown shows only Withdrawn + wait line, Convert greyed; agent commission change after review → badge back, pending lines, pencil hidden; admin Approve and Reject (reason required, values restored); admin Close/Convert refused with the pending message. Desktop 1440 and phone 390.
- [ ] **Step 3:** Pixel-compare unflagged agent and admin file pages at 1440 against a pre-change build → identical.
- [ ] **Step 4:** Full suite + tsc pass. **Commit** `feat: review state on file pages`.

---

### Task 11: Live email test, speed check, wrap-up

- [ ] **Step 1:** Send one of each new email to `ryanchong@cncrealtygroup.com` via a temporary dev-only route calling the real functions (delete the route immediately; never commit it). Report the Postmark MessageIDs.
- [ ] **Step 2:** Targeted speed check (numeric only, one desktop + one phone size): agent file page, admin file page, agent Transactions list, before vs after. Expect equal.
- [ ] **Step 3:** Clean production build passes.
- [ ] **Step 4:** Confirm Foster Road is back to its original values (read-only query).
- [ ] **Step 5: Commit** any remaining docs; ask Ryan before pushing (push = live deploy; the migration is already live).
