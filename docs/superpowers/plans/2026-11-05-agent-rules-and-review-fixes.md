# Agent Rules in the Transactions Tab + Review Fix Round — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an admin's Agent-section Transactions tab follow agent rules, on screen and on the server. Move the
referral broker steps to the Admin file page. Fix the chosen Awaiting Review follow-ups.

**Architecture:** Pages in the Agent-section Transactions tab send an `x-cnc-agent-view: 1` header on every write.
One server helper, `actingRole(sessionRole, req)`, turns that into `"AGENT"` for an admin, and every file route uses
it wherever it used the session role. One client context (`AgentViewProvider` + `useFileFetch`) adds the header for
shared components only when they render inside the agent page. The agent page always treats its viewer as an
agent. It sends an admin who isn't the file's agent to the Admin page.

**Tech Stack:** Next.js 14 App Router, Prisma 5 (Neon), NextAuth JWT, Vitest (node environment, `src/**/*.test.ts`,
no React render tests), pnpm, Windows.

**Spec:** `docs/superpowers/specs/2026-11-05-agent-rules-in-transactions-tab-and-review-fixes-design.md` (follows
`docs/superpowers/specs/2026-11-04-awaiting-review-commission-and-status-design.md`).

## Global Constraints

- Scope: the Agent-section Transactions tab only. That means the file list, the listing/transaction file page and
  the New Listing / New Transaction wizards. No other Agent-section tab changes.
- Covers listings AND transactions, agent AND admin, desktop AND phone.
- The marker can only remove rights. `actingRole` never returns `"ADMIN"` for a non-admin session.
- No new database queries on any page load. No migration.
- Reuse shared components. Do not add a new UI component. `ReferralActions` moves out of the agent page into a
  shared file. It is not rewritten.
- Exact copy:
  - wait line: `Waiting for broker review` (`REVIEW_WAIT_MESSAGE`, already exists);
  - 409: `This change was already decided`;
  - referral guard: `Enter the referral amount received first`;
  - number guard: `Commission must be a number`;
  - rejection email body line: `Hi {agent name}, your commission change on <strong>{address}</strong> was not
    approved.`
- Review emails stay at `BROKER_EMAIL` (info@). Do not change it.
- Desktop layout unchanged, except that the referral broker steps appear on the Admin file page. They go in the
  header next to the status control, in the same spot as on the agent page today.
- After any email-template change, send a live test to ryanchong@cncrealtygroup.com.
- Local dev and production share one Neon DB. Never run the full seed. Never source `.env` (it has a BOM).
  Restore any test record you touch.
- Builds only with no dev server running. If a background process dies, report it and stop. Do not restart it.
- Verification per task: `pnpm --filter web exec vitest run <files>`. In the final task: full suite,
  `pnpm --filter web exec tsc --noEmit`, `rm -rf apps/web/.next && pnpm --filter web build`.
- Speed check: targeted only. Agent and Admin file pages, one desktop (1440×900) and one phone (390×844) size,
  old build vs new build, numeric. No screenshot sweep.

## Review Focus

1. **Document upload.** The R2 presigned `PUT` must never carry the `x-cnc-agent-view` header. An extra header
   breaks the signature/CORS and every upload fails. Expect uploads to keep working (Task 3 test).
2. **Admin file page.** Shared components rendered on the Admin file page must not send the marker. Otherwise Ryan
   silently loses admin rights there. Expect no header outside `AgentViewProvider` (Task 3 test).
3. **Forged header.** An AGENT (or BUYER) session with a forged `x-cnc-agent-view: 1` must end up with exactly its
   own role (Task 1 test).
4. **Approve and Reject race.** Approve, then Reject, on the same pending change. Expect one decision. The second
   gets 409 with no email and no second Activity row (Task 6 test).
5. **Blank referral amount.** A blank or whitespace amount on the Admin page must never move the file to Referral
   Broker Review (Task 5 tests: server 400 + client helper).

---

### Task 1: Agent-view marker and `actingRole`

**Files:**
- Create: `apps/web/src/lib/agent-view.ts`
- Modify: `apps/web/src/lib/api-auth.ts`
- Test: `apps/web/src/__tests__/lib/agent-view.test.ts`

**Interfaces:**
- Produces (`lib/agent-view.ts`, no server imports; client-safe):
  - `export const AGENT_VIEW_HEADER = "x-cnc-agent-view"`
  - `export function withAgentView(init?: RequestInit): RequestInit`. It returns `init` with `AGENT_VIEW_HEADER: "1"`
    merged into its headers. It keeps the existing headers, whether they come as an object or a `Headers`.
  - `export function adminFilePathFor(viewer: { role?: string | null; agentId?: string | null }, file: { agentId: string }, fileType: "listing" | "transaction", id: string): string | null`.
    It returns `/admin/transactions/${fileType}/${id}` when the viewer role is `"ADMIN"` and
    `viewer.agentId !== file.agentId`. Otherwise it returns `null`.
- Produces (`lib/api-auth.ts`): `export function actingRole(sessionRole: string, req: Request): string`. It returns
  `"AGENT"` when `sessionRole === "ADMIN"` and the request header `AGENT_VIEW_HEADER` equals `"1"`. Otherwise it
  returns `sessionRole` unchanged.

- [ ] **Step 1: Write the failing tests** in `agent-view.test.ts`:
  - `actingRole("ADMIN", reqWith("1")) === "AGENT"`
  - `actingRole("ADMIN", reqWithout) === "ADMIN"`
  - `actingRole("AGENT", reqWith("1")) === "AGENT"`
  - `actingRole("BUYER", reqWith("1")) === "BUYER"` (Review Focus 3)
  - `actingRole("ADMIN", reqWith("0")) === "ADMIN"`
  - `withAgentView({ headers: { "Content-Type": "application/json" } })` has both headers.
  - `withAgentView()` has only the marker.
  - With a `Headers` instance, the result still contains `Content-Type`.
  - `adminFilePathFor({ role: "ADMIN", agentId: "a1" }, { agentId: "a2" }, "transaction", "t9") === "/admin/transactions/transaction/t9"`
  - Same viewer, `{ agentId: "a1" }` returns `null`.
  - `{ role: "AGENT", agentId: "a1" }` on an `a2` file returns `null` (the API already 403s agents).
  - An admin with `agentId: null` returns the admin path.
- [ ] **Step 2: Run** `pnpm --filter web exec vitest run src/__tests__/lib/agent-view.test.ts`. Expected: FAIL, the
  module is not found.
- [ ] **Step 3: Implement** the three exports in `lib/agent-view.ts` and `actingRole` in `lib/api-auth.ts`
  (import `AGENT_VIEW_HEADER` from `lib/agent-view.ts`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: agent-view marker and actingRole helper`.

### Task 2: File routes act on `actingRole`

**Files (modify):** every handler below that writes. Replace each `session.user.role` used for permission,
ownership, lock or status rules with `const role = actingRole(session.user.role, req)`. Keep it in one local.
- `app/api/listings/[id]/route.ts` PATCH (DELETE stays admin-only; leave it)
- `app/api/listings/[id]/convert/route.ts` POST
- `app/api/listings/[id]/submit-review/route.ts` POST
- `app/api/transactions/[id]/route.ts` PATCH
- `app/api/transactions/[id]/submit-review/route.ts` POST
- `app/api/transactions/[id]/conditions/route.ts` POST
- `app/api/files/[fileType]/[id]/note/route.ts` POST
- `app/api/files/[fileType]/[id]/parties/route.ts` POST, including the `maybeAutoPending` actor
- `app/api/files/[fileType]/[id]/parties/[partyId]/route.ts` PATCH, DELETE
- `app/api/documents/route.ts` POST
- `app/api/documents/[id]/remove/route.ts` POST
- `app/api/upload-url/route.ts` (whichever handler calls `getFileAndVerifyAccess`)
- `app/api/file-tasks/route.ts` POST; `app/api/file-tasks/[taskId]/route.ts` PATCH, DELETE
- Rename unused `_req` params to `req` where the handler now reads it.
- Leave all GET handlers and every `/api/admin/*` route alone.
- Activity rows written by these routes record the acting role (spec builder's call 1).

**Interfaces:** Consumes `actingRole` and `AGENT_VIEW_HEADER` (Task 1).

**Tests:** in the existing route test files (`__tests__/api/…`). For each route group, add a test proving the
marker changes the outcome for an admin. Expected results:
- `listings/[id]` PATCH: admin + marker, commission edit on an own file with `awaitingReview: true` → 403
  (commission locked). Admin without marker → 200.
- `transactions/[id]` PATCH: admin + marker, a non-exit status the transition table allows, while awaiting review, → 400
  `Waiting for broker review`. Without marker → allowed.
- `listings/[id]/convert`: admin + marker on a flagged listing → refused with `Waiting for broker review`.
- `documents/[id]/remove`: admin + marker on an approved document → 400 (only in-review documents). Admin + marker
  on another agent's upload → 403.
- `parties` POST, `note` POST, `file-tasks` POST, `upload-url`: admin + marker on another agent's file → 404/403
  (whichever the route already returns for an agent).
- `transactions/[id]/conditions` POST, `submit-review` (both) and `parties/[partyId]`: admin + marker on another
  agent's file → the route's existing agent refusal.
- One test in `transactions/[id]` PATCH: an AGENT session with a forged marker header behaves exactly as without it.

- [ ] **Step 1: Write the failing tests** above (build requests with `new Request(url, { headers: { "x-cnc-agent-view": "1" } , … })`).
- [ ] **Step 2: Run** the touched test files. Expected: the new tests FAIL (the admin still gets admin rights).
- [ ] **Step 3: Implement** the replacements.
- [ ] **Step 4: Run** the touched test files. Expected: PASS, including every existing test.
- [ ] **Step 5: Commit** `feat: file routes apply agent rules when the agent view marker is sent`.

### Task 3: Client side sends the marker only from the agent view

**Files:**
- Create: `apps/web/src/components/transactions/AgentViewContext.tsx`.
  - `"use client"`.
  - `export function AgentViewProvider({ children }: { children: React.ReactNode })`
  - `export function useFileFetch(): typeof fetch`. Inside the provider, it returns
    `(input, init) => fetch(input, withAgentView(init))`. Outside, it returns plain `fetch`.
- Modify `apps/web/src/lib/document-actions.ts`: `removeFromChecklist(documentId: string, fetchImpl: typeof fetch = fetch)`
  and `deleteDocumentPermanently(documentId, reason, fetchImpl: typeof fetch = fetch)`.
- Modify `apps/web/src/hooks/useFileUpload.ts`. `uploadDocument(…)` and `useFileUpload(…)` take an optional
  `fetchImpl: typeof fetch = fetch`. Use it for `/api/upload-url` and `/api/documents`. **The R2 `PUT` keeps using
  global `fetch`** (Review Focus 1).
- Modify these shared components to use `useFileFetch()` for their file-route calls: `ActivityFeed.tsx`,
  `PartiesTable.tsx`, `TransferPendingPanel.tsx`, `ConvertListingModal.tsx`, `ChecklistPanel.tsx` (its
  `useFileUpload` and `removeFromChecklist`), `AdditionalDocuments.tsx`.
- Modify the agent file page `app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`:
  - wrap its returned tree in `<AgentViewProvider>`;
  - its own writes use `withAgentView`: status/submit POST, PATCH (`handleSave` area ~l.144), file-tasks
    POST/PATCH/DELETE.
- Modify `new-transaction/page.tsx`: its `/conditions` POST uses `withAgentView`. `new-listing/page.tsx` has no file
  route writes, so no change is needed there. Record that in the report.
- The Admin file page is not wrapped. It sends no marker (Review Focus 2).
- `useFileFetch` must be stable (`useCallback`/`useMemo`) so it doesn't retrigger effects.

**Interfaces:** Consumes `withAgentView`, `AGENT_VIEW_HEADER` (Task 1). Produces `AgentViewProvider`,
`useFileFetch` (used by Task 4).

**Tests:** `__tests__/hooks/useFileUpload.test.ts` (create or extend). Call the exported `uploadDocument` with a
mocked `fetchImpl` that records calls, and a mocked global `fetch`:
- the upload-url and `/api/documents` calls go through `fetchImpl`;
- the R2 `PUT` goes through global `fetch`;
- its headers contain only `Content-Type` and no `x-cnc-agent-view`.
`__tests__/lib/document-actions.test.ts`: `removeFromChecklist("d1", spy)` calls `spy` with
`/api/documents/d1/remove`.

- [ ] **Step 1: Write the failing tests.** **Step 2: Run, expect FAIL.** **Step 3: Implement.** **Step 4: Run,
  expect PASS.** **Step 5: Commit** `feat: agent file page and wizard send the agent view marker`.

### Task 4: Agent page treats its viewer as an agent + safety net + shared `ReferralActions`

**Files:**
- Create: `apps/web/src/components/transactions/ReferralActions.tsx`.
  - Move the `ReferralActions` function out of the agent page unchanged in look.
  - New props: `{ transaction: TransactionFileDetail; mode: "agent" | "broker"; viewerIsFileAgent: boolean; onDone: () => void }`.
  - `mode: "agent"` renders only the file-agent branches (`PENDING` → Successful/Unsuccessful).
  - `mode: "broker"` renders only today's `viewerIsAdmin` branches: the amount box at `REFERRAL_SUCCESSFUL`, and
    Mark Closed at `REFERRAL_BROKER_REVIEW`/`REFERRAL_UNSUCCESSFUL`.
  - Its PATCH uses `useFileFetch()`.
  - The amount submit is refused client-side when `!amount.trim()`. That check exists today; keep it.
- Modify the agent file page:
  - Delete `viewerIsAdmin` from permission logic. Use the literal `"AGENT"` for `isFileReadOnlyFor`,
    `isCommissionLockedFor`, `convertBlockedReason`.
  - `inReview = !!file.awaitingReview`.
  - `canChangeRepresentation={false}`.
  - Render `<ReferralActions mode="agent" …/>`.
  - Re-indent the status-dropdown wrapper (spec item 15).
  - Safety net: after the file loads, `const to = adminFilePathFor(session?.user ?? {}, file, fileType, id)`. If
    `to` is set, `router.replace(to)` and render nothing else. Use the existing load result: no extra fetch.
- Pending commission on the agent page shows the agent view ("new value + Waiting for broker review") for everyone,
  since the viewer is always an agent here.

**Interfaces:** Consumes `adminFilePathFor`, `useFileFetch`. Produces `ReferralActions` (mode prop), used by
Task 5.

**Tests:** the redirect rule is covered by Task 1's `adminFilePathFor` tests. Add `__tests__/lib/file-lock.test.ts`
cases pinning the agent-role values the page now passes:
- `isCommissionLockedFor(true, "AGENT") === true`
- `isFileReadOnlyFor("transaction", "CLOSED", "AGENT") === true`

(Pure; no render infra exists — React render tests were deliberately not added, 2026-07-16.)

- [ ] **Step 1–4** TDD as above. **Step 5: Commit** `feat: agent file page follows agent rules; referral steps shared`.

### Task 5: Referral broker steps on the Admin file page + Broker Review guard

**Files:**
- Modify `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`:
  - render `<ReferralActions mode="broker" viewerIsFileAgent={false} …/>` for referral files, in the header next to
    the status control (where it sits on the agent page);
  - its status options for referral files are `withoutReferralReview(allowedNextStatuses(kind, file.status, "ADMIN"))`.
- Modify `lib/transaction-helpers.ts`: add
  `export function withoutReferralReview(options: string[]): string[]`, which drops `"REFERRAL_BROKER_REVIEW"`.
- Modify `app/api/admin/files/[fileType]/[id]/status/route.ts`: `status === "REFERRAL_BROKER_REVIEW"` → 400
  `Enter the referral amount received first`.
- Modify `app/api/transactions/[id]/route.ts` PATCH: `body.status === "REFERRAL_BROKER_REVIEW"` with a missing,
  blank, or non-finite `referralAmountReceived` → 400 with the same message.

**Interfaces:** Consumes `ReferralActions` (Task 4).

**Tests:**
- `transaction-helpers.test.ts`: `withoutReferralReview(["CLOSED","REFERRAL_BROKER_REVIEW"])` → `["CLOSED"]`.
- `admin-files-status.test.ts`: REFERRAL_BROKER_REVIEW → 400 with that message, and `changeFileStatus` is not called.
- `transactions-id.test.ts`:
  - amount `"  "` → 400 (Review Focus 5);
  - amount absent → 400;
  - amount `"5000"` → 200 and `referralCncFee` written.
- The existing referral full-lifecycle integration test still passes. Its admin steps don't send the marker, so the
  admin keeps broker rights through PATCH.

- [ ] TDD steps 1–4. **Step 5: Commit** `feat: referral broker steps on the admin file page; Broker Review needs an amount`.

### Task 6: `resolveCommissionChange` — decide once, write together, report a missing email

**Files:** `lib/commission-review-db.ts`, `app/api/admin/files/[fileType]/[id]/commission-review/route.ts`.

- Inside `prisma.$transaction(async (tx) => …)`, two steps. Precedent: `api/admin/documents/[id]/approve/route.ts`.
  - `updateMany` with `where: { id: fileId, pendingCommission: { path: ["requestedAt"], equals: pending.requestedAt } }`.
    If `count === 0`, abort and return `{ ok: false, status: 409, error: "This change was already decided" }`.
  - Create the Activity row, then re-read the file to return it.
- The email is sent only after the transaction commits.
- If the file has no agent user, or no email, on reject: call `Sentry.captureMessage` (as elsewhere) and set
  `emailWarning: true`.
- The file include loads `agent: { include: { user: { select: { name: true, email: true } } } }`.
- Route: `const body = await req.json().catch(() => null)`. When `body` is not a plain object, return 400
  `decision must be approve or reject`.

**Tests** (`commission-review-db.test.ts`, `admin-commission-review.test.ts`):
- `updateMany` count 0 → 409, no activity, no email (Review Focus 4);
- the activity create throws → result not ok, no email sent;
- reject with `agent: null` → ok, `emailWarning: true`, Sentry called;
- route body `null` → 400;
- route body `"x"` → 400.

- [ ] TDD steps 1–4. **Step 5: Commit** `fix: commission decisions apply once, atomically, and flag a missing agent email`.

### Task 7: One commission number check on every save

**Files:**
- `lib/file-edit.ts`: `export function commissionNumberError(body: Record<string, unknown>): string | null`. It
  returns `"Commission must be a number"` when any field in `TX_COMMISSION` or `LISTING_COMMISSION` is present, not
  blank, and `!Number.isFinite(parseFloat(String(v)))`. Otherwise it returns null.
- Call it next to `commissionPercentError` in `api/listings/route.ts`, `api/listings/[id]/route.ts`,
  `api/transactions/route.ts`, `api/transactions/[id]/route.ts` (400).
- `lib/commission-review.ts`: `buildPendingCommission` throws `Error("Commission must be a number")` on a
  non-finite value in `before`. That is a second line of defense; the routes refuse first.

**Tests:**
- `"abc"` → message;
- `"Infinity"` → message;
- `""` → null;
- `"2.5"` → null;
- one route test per route: admin PATCH `saleCommissionPct: "abc"` → 400, nothing updated;
- `buildPendingCommission` with `NaN` throws.

- [ ] TDD steps 1–4. **Step 5: Commit** `fix: refuse non-numeric commission on every save`.

### Task 8: Shared Approve/Reject buttons

**Files:** `components/ui/ApproveReject.tsx`.
- Every button gets `type="button"`.
- The Reject toggle is `disabled={busy}`.
- Cancel keeps clearing the reason. That is today's behavior, because `RejectReasonForm` unmounts. The checklist
  and the commission row both use it, so both clear (Ryan's item 8).

**Tests:** none possible without render infra (decided 2026-07-16). The live check in Task 11 covers it. Record that
ruling in the report.

- [ ] Implement, `tsc`, commit `fix: approve/reject buttons are type=button and Reject waits while saving`.

### Task 9: Commission emails — one change-line helper, new wording

**Files:** `lib/email/transaction-emails.ts`.
- `function commissionChangeLines(changes: CommissionChange[], direction: "forward" | "undo"): string`. One `<p>` per
  change:
  - `forward`: `label: from → to`;
  - `undo`: `label: to → from`.
  - Escaped, with `CHANGE_LINE_STYLE`.
- Both send functions use it.
- `sendCommissionChangeRejected` body line becomes exactly:
  `Hi ${escapeHtml(agentName)}, your commission change on <strong style="color: #1B1B1B;">${escapeHtml(address)}</strong> was not approved.`
  (keep the existing strong styling).

**Tests** (`__tests__/lib/transaction-emails*.test.ts`, extend the existing file):
- a change label with `<b>` is escaped in both emails;
- agent name `O'Brien` is escaped once in the greeting;
- the rejection subject equals `Commission Change Not Approved — 11538 Foster Road`;
- a listing rejection's CTA link contains `/dashboard/transactions/listing/`;
- the body contains `was not approved.` and not `back to what it was`.

- [ ] TDD steps 1–4. **Step 5: Commit** `fix: shared commission change lines; shorter rejection wording`.
- [ ] **Step 6: Live test send** of `sendCommissionChangeRejected` to ryanchong@cncrealtygroup.com through a
  throwaway script that imports the real function. Delete the script. Record the Postmark MessageID.

### Task 10: Tidy-ups and missing tests

**Files and changes:**
- Move `CommissionChange` and `PendingCommission` types to `types/transaction.ts`. `lib/commission-review.ts`
  imports them from there (re-export for existing importers is not needed; update imports).
- Create `apps/web/src/__tests__/fixtures/files.ts`. It is not matched by `*.test.ts`. Use it for the duplicated
  submit-review fixtures and the duplicated COMPLETE fixtures in `file-status.test.ts`, and use it in those three
  test files.
- Missing tests:
  - `buildPendingCommission("transaction", …)`;
  - `isAfterReview` with `awaitingReview: undefined`;
  - the approve route leaves the badge on for a transaction with a pending commission;
  - `changeFileStatus` refuses an agent's non-exit status on a transaction under review;
  - a pending-but-unflagged file for an agent;
  - reject restores a flat-$ transaction commission and a lease commission (GCI recomputed);
  - reject writes a `COMMISSION_CHANGE_REJECTED` row with `transactionFileId` for a transaction.

- [ ] Write the tests (each must FAIL if you break the code it covers; spot-check one by breaking and restoring),
  run them, move the types, run the full touched set, commit `test: shared fixtures, type move, missing review tests`.

### Task 11: Verify, speed check, live check

- [ ] Full suite `pnpm --filter web exec vitest run` → all pass; `tsc --noEmit` → 0 errors.
- [ ] With no dev server running: `rm -rf apps/web/.next && pnpm --filter web build` → success.
- [ ] Targeted speed check. Use a baseline worktree at the plan's BASE commit, built, and serve old and new with
  `next start` on two ports (confirm the BUILD_ID). Time the agent file page and the admin file page for Foster Road
  (`cmvivu9290001n3iejhf2jtap`) at 1440×900 and 390×844, 5 runs each, numeric only. Pass: new is not slower than
  old beyond noise. Report a table. Remove the worktree after.
- [ ] Live check on the dev server, with a locally minted JWT for Ryan's admin. No real emails, except the one in
  Task 9.
  - Agent page on Foster Road: no Change representation; status options are agent options.
  - A PATCH with the marker to a non-exit status while flagged → 400. Restore any flag you set.
  - The Admin page renders the referral steps for a referral file, if one exists. Otherwise report "no referral
    file to view".
  - Upload one tiny test document through the agent page's upload path with the marker. It succeeds. Then delete
    it permanently and confirm Foster Road is back to baseline (ACTIVE, flag false, 2.5%, pending IS NULL, no
    leftover activity rows).
- [ ] Report: suite count, build result, speed table, live results, rulings.
