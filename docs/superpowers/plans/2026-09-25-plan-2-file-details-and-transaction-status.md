# Plan 2 — Edit Details, Lease Dates & Transaction Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agents and the broker edit any file's details row-by-row, give leases their own dates, make transaction status follow its details and dates, and give agents a transaction status dropdown with reasoned cancellation requests.

**Architecture:** Pure rules in `lib/` (unit-tested in vitest's node env): `dateDrivenStatus`, `isReadyForPending`, `transactionStatusOptions`, required-field checks. Routes call them on save; the existing morning job calls `dateDrivenStatus`. UI extends shared components (`InfoRow`, `OverviewTab`, `FileStatusSelect`, `ActivityFeed`) — both the agent and admin file pages render them, so every change covers agent + admin × listing + transaction.

**Tech Stack:** Next.js 14 App Router, Prisma/Neon, Vitest (node), Tailwind, Postmark via `lib/email`.

**Spec:** `docs/superpowers/specs/2026-09-25-plan-2-file-details-and-transaction-status-design.md`

## Global Constraints
- Applies to all listing types and transaction sides, agent and admin pages; referral files keep their own flow.
- Check for an existing shared component/helper before creating one; extend rather than duplicate.
- All buttons are pills (`rounded-full`); icons are shared `currentColor` components in `components/ui/`.
- TDD per task: RED (watch it fail for the right reason) → GREEN → full `npx vitest run` + `npx tsc --noEmit -p .` + `npx next lint --file <changed>` (from `apps/web`) → commit with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.
- Task 3's migration touches the shared dev/prod Neon DB — **ask Ryan first**; regenerate the client only after stopping just the process that holds the Prisma engine (identify it; never kill all node processes).
- Any email-template change: send a live test to ryanchong@cncrealtygroup.com.
- No new queries on page loads or tab switches.

---

### Task 1: Shared icons + checkmark replacements
**Files:** Create `src/components/ui/PencilIcon.tsx`, `CheckIcon.tsx`, `CheckCircleIcon.tsx`. Modify `components/transactions/ChecklistPanel.tsx` (Approved icon), `DocumentReviewCard.tsx` (Approve button), `components/join/AgentPlan.tsx` (delete local `CheckIcon`), `new-transaction/page.tsx:481` ("Photo uploaded ✓"), `components/leads/LeadActionPlansSection.tsx:212` (DONE "✓").
**Produces:** `PencilIcon`, `CheckIcon`, `CheckCircleIcon` — `({ size?: number; className?: string })`, `currentColor` strokes, `aria-hidden`.
- [ ] Icons from the SVGs: pencil = `pen-svgrepo-com.svg` path (stroke 1.5, round cap); check = `unread-svgrepo-com.svg` path (stroke 1.5, round cap/join); circle-check = Solar path `M20.94,11A8.26,8.26,0,0,1,21,12a9,9,0,1,1-9-9,8.83,8.83,0,0,1,4,1` + polyline `21 5 12 14 8 10` (identical to AgentPlan's).
- [ ] Replace: ChecklistPanel `<CheckCircle className="h-4 w-4 text-green-600" />` → `<CheckCircleIcon size={16} className="text-green-600" />`; DocumentReviewCard Approve `<CheckCircle className="h-3 w-3" />` → `<CheckCircleIcon size={12} />`; AgentPlan `<CheckIcon />` → `<CheckCircleIcon size={18} className="mt-[1px] flex-shrink-0 text-[#9E8C61]" />` (visually identical); "Photo uploaded ✓" → text + `<CheckIcon size={14} className="inline" />`; Action Plan DONE → `<CheckIcon size={14} className="mx-auto" />`. Drop unused lucide `CheckCircle` imports.
- [ ] UI-only (no DOM tests) — gate: tsc + lint + suite; Ryan confirms visually. Commit `style: shared Pencil/Check/CheckCircle icons; replace checkmarks`.

### Task 2: MLS # optional in the New Transaction wizard
**Files:** `new-transaction/page.tsx` (lines 201, 205, 417), `api/transactions/route.ts:58`; tests in `src/__tests__/api/transactions*.test.ts` that require MLS.
- [ ] RED: API test "creates a non-referral transaction without an MLS number" (expect 201, `mlsNumber: null`); flip any existing "400 without MLS" test to this.
- [ ] GREEN: drop `!mlsNumber` from the POST guard; wizard: remove `!!form.mlsNumber` from the Step 1 gate and deps, label `"MLS Number"`, `placeholder="Optional"`, keep `digitsOnly(v, 10)`.
- [ ] Gate + commit `feat: MLS number is optional on transactions`.

### Task 3: Lease date fields (migration — ASK RYAN FIRST)
**Files:** `packages/database/prisma/schema.prisma` (`TransactionFile`), migration `…_add_transaction_lease_dates/migration.sql`, `src/types/transaction.ts` (`TransactionFileDetail`), `api/transactions/route.ts` (accept/save), `src/lib/transaction-helpers.ts` (`isLeaseSide`).
**Produces:** `leaseSignedDate?: string | null`, `leaseStartDate?: string | null`; `isLeaseSide(side: string): boolean` (LEASE_TENANT/LANDLORD/DUAL) — reuse `LEASE_SIDES` if already exported (check `lib/commission.ts`).
- [ ] SQL: `ALTER TABLE "TransactionFile" ADD COLUMN "leaseSignedDate" TIMESTAMP(3), ADD COLUMN "leaseStartDate" TIMESTAMP(3);`
- [ ] RED/GREEN: POST saves both dates for a lease side; ignores them for sale sides.
- [ ] With OK: `prisma migrate status` → `migrate deploy` → `generate` → gate → commit `feat: dedicated lease signed/start dates on transactions`.

### Task 4: Shared date-driven status rule
**Files:** `src/lib/auto-status.ts` (+ tests).
**Produces:** `dateDrivenStatus(f: { kind: "listing" | "transaction"; status: string; transactionSide?: string; listDate?: Date | string | null; expirationDate?: Date | string | null; closeOfEscrow?: Date | string | null; leaseStartDate?: Date | string | null }, today: Date): string | null`.
- [ ] RED: listing COMING_SOON + listDate ≤ today → ACTIVE; ACTIVE/COMING_SOON + expiration < today → EXPIRED; **EXPIRED + expiration ≥ today → ACTIVE**; INCOMPLETE → null; transaction PENDING + key date < today → EXPIRED; EXPIRED + key date ≥ today → PENDING; key date = closeOfEscrow for sales, **leaseStartDate for lease sides**; no key date → null; other statuses → null.
- [ ] GREEN, then refactor `runAutoStatus` to select candidates by status and apply `dateDrivenStatus` (queries: listings in COMING_SOON/ACTIVE/EXPIRED; transactions in PENDING/EXPIRED — still indexed on status). Existing auto-status tests stay green; add lease-side cases.
- [ ] Gate + commit `refactor: one shared date-driven status rule (listings, sales, leases)`.

### Task 5: `isReadyForPending` + automatic Pending
**Files:** `src/lib/transaction-helpers.ts` (+ tests), `src/lib/file-status.ts` (guard + optional activity payload), `api/transactions/route.ts` (POST), `api/transactions/[id]/route.ts` (PATCH), `api/files/[fileType]/[id]/parties/route.ts` + `[partyId]/route.ts` (POST/DELETE re-check).
**Produces:** `isReadyForPending(tx: { transactionSide: string; salePrice?: number | null; leasePrice?: number | null; acceptanceDate?: unknown; closeOfEscrow?: unknown; leaseSignedDate?: unknown; leaseStartDate?: unknown }, parties: { role: string; name: string }[]): boolean`; `maybeAutoPending(transactionId, actor): Promise<void>` in `lib/file-status.ts`.
- [ ] RED (pure): sale side needs salePrice + acceptanceDate + closeOfEscrow + required parties (PURCHASE: SELLER; LISTING: BUYER; DUAL: both — mirror the wizard's `partiesReady`); lease sides need leasePrice + leaseSignedDate + leaseStartDate + TENANT/LANDLORD per side (tenant = BUYER role, landlord = SELLER role, as the wizard stores them); REFERRAL → false.
- [ ] RED (routes): POST creates `PENDING` when ready (else INCOMPLETE/PRE_CONTRACT); PATCH on an INCOMPLETE/PRE_CONTRACT file that becomes ready → status PENDING + `STATUS_CHANGED { automatic: true }`; adding the last required party does the same; `changeFileStatus` → `PENDING` for an agent when not ready → 400 `"Add the price, dates and parties this transaction needs before it can be Pending"`; broker exempt.
- [ ] GREEN: `changeFileStatus` accepts optional `activityPayloadExtra` (merged into the STATUS_CHANGED payload); `maybeAutoPending` loads file + parties, and when status ∈ {INCOMPLETE, PRE_CONTRACT} and ready, calls `changeFileStatus(..., toStatus: "PENDING", activityPayloadExtra: { automatic: true })`.
- [ ] Gate + commit `feat: transactions become Pending automatically once complete`.

### Task 6: Server edit rules (PATCH allowlists + required fields + date follow-up)
**Files:** `api/transactions/[id]/route.ts`, `api/listings/[id]/route.ts`, `src/lib/transaction-helpers.ts` (`requiredFieldError`), tests.
**Produces:** `requiredFieldError(kind, field, value, file): string | null` — listing: propertyAddress/city/zip/listPrice/listDate/expirationDate can't be blank; transaction (non-referral): propertyAddress/city/zip/propertyType/salePrice (sale sides)/leasePrice (lease sides).
- [ ] RED: transaction PATCH accepts every editable field from the spec (mlsNumber, propertyType, yearBuilt, escrowNumber, listPrice, salePrice, leasePrice, legalDescription, propertyIncludes, propertyExcludes, taxId, numberOfParcels, schoolDistrict, zoningClass, offerDate, offerExpirationDate, acceptanceDate, inspectionDeadline, appraisalDeadline, loanApprovalDeadline, closeOfEscrow, finalWalkthroughDate, possessionDate, leaseSignedDate, leaseStartDate) with blanks → null for optional fields; clearing a required field → 400 with the field's message; after a date save, `dateDrivenStatus` against the saved values → status change logged `automatic` (listing EXPIRED + later expiration → ACTIVE; transaction EXPIRED + later key date → PENDING); then `maybeAutoPending`.
- [ ] GREEN, gate, commit `feat: file detail edits are validated and move status with the dates`.

### Task 7: Pencil editing (InfoRow + OverviewTab, agent + admin)
**Files:** `components/transactions/InfoRow.tsx`, `OverviewTab.tsx`, both file pages; `PROPERTY_TYPES` moved from `new-transaction/page.tsx` to `src/types/property.ts` (shared by the wizard and the Property Type select).
**Produces:** `InfoRow` optional `edit?: { kind: "text" | "digits" | "currency" | "number" | "date" | "select"; raw: string; options?: readonly string[]; maxDigits?: number; onSave: (value: string) => Promise<string | null> }`; `OverviewTab` props `canEdit: boolean; onSaved: () => void`; shared client helper `saveFileField(fileType, id, field, value): Promise<string | null>` in `lib/document-actions.ts`'s sibling `lib/file-actions.ts` (+ fetch-mocked tests, same pattern).
- [ ] RED: `saveFileField` PATCH shape + error fallback tests.
- [ ] GREEN: InfoRow renders `PencilIcon` (14px, `text-[#1B1B1B]/25 hover:text-[#1B1B1B]`) when `edit` set; edit mode uses `FormField` (text/digits/number via `restrict`), `FormField formatCommas` (currency), `DateField` (date), or a select; `CheckIcon` save + `✕` cancel; inline error. OverviewTab: editable rows always render (value or "—") when `canEdit`, per the spec's lists (sale vs lease key dates; State/Type/Side never); non-editable optional rows keep hide-when-empty. Agent page `canEdit = !readOnly && viewer owns file && !isReferral`; admin page `canEdit = !isReferral`.
- [ ] Gate, commit `feat: edit file details row by row (agent + admin, listings + transactions)`.

### Task 8: Wizard — Under Contract required dates, lease fields, lease-only display
**Files:** `new-transaction/page.tsx` (Step 2 gate + fields + Review), `OverviewTab.tsx` Key Dates (lease branch), `src/lib/transaction-wizard.ts` (new pure gate, mirroring `listing-wizard.ts`) + tests.
**Produces:** `transactionStep2Ready(form, stage, isLeaseSide): boolean`.
- [ ] RED: Under Contract sale → needs salePrice + acceptanceDate + closeOfEscrow (closeOfEscrow ≥ acceptanceDate); Under Contract lease → leasePrice + leaseSignedDate + leaseStartDate; Pre-Contract → price only (today's rule).
- [ ] GREEN: wizard uses it; lease sides show "Lease Signed Date *" / "Lease Start Date *" (required only Under Contract) and hide Close of Escrow / Inspection / Appraisal / Loan Approval; Review shows lease dates with `formatDateMDY`; POST sends them.
- [ ] Gate, commit `feat: Under Contract wizard files carry their key dates; leases get lease dates`.

### Task 9: Agent transaction status dropdown
**Files:** `src/lib/transaction-helpers.ts` (`transactionStatusOptions`, agent table: INCOMPLETE/EXPIRED → CANCELED_PENDING), agent file page, tests.
**Produces:** `transactionStatusOptions(status: string, role: ActorRole): string[]` — AGENT: INCOMPLETE → [PRE_CONTRACT, CANCELED_PENDING]; PRE_CONTRACT/PENDING/EXPIRED → [CANCELED_PENDING]; otherwise []; never PENDING, never REFERRAL_*. ADMIN: unchanged admin list minus REFERRAL_* on non-referrals.
- [ ] RED/GREEN tests; agent page renders `FileStatusSelect` (last in header) on non-referral, non-locked transactions; `statusLabel` shows CANCELED_PENDING as "Request Cancellation" **in the agent dropdown only** (option label override prop on `FileStatusSelect`: `optionLabel?: (s: string) => string`).
- [ ] Gate, commit `feat: agents can move a transaction to Pre-Contract or request cancellation`.

### Task 10: Cancellation requests (reason, email, Awaiting Review)
**Files:** `api/transactions/[id]/route.ts` (require `cancellationReason` when an agent moves to CANCELED_PENDING; pass into payload), `lib/file-status.ts` (payload extra), `lib/activity-detail.ts` (show `reason` for STATUS_CHANGED), `lib/email/transaction-emails.ts` (`sendCancellationRequested`), `api/admin/audit-queue/route.ts` (transactions `OR: [{ awaitingReview: true }, { status: "CANCELED_PENDING" }]`), agent page (inline reason form — Reject pattern), admin page (reason banner while Cancel Pending), tests.
- [ ] RED: agent CANCELED_PENDING without reason → 400 `"Please give a reason for the cancellation"`; with reason → payload `{ from, to, reason }`, email sent via `sendSafely` to the broker; describeActivity shows the reason; audit queue returns a CANCELED_PENDING transaction that isn't awaitingReview.
- [ ] GREEN; live test email to ryanchong@cncrealtygroup.com; gate; commit `feat: reasoned cancellation requests reach the broker by email and queue`.

### Task 11: Deadline reminders only for active files
**Files:** `api/cron/deadline-reminders/route.ts`, its test.
- [ ] RED: query uses `status: { in: ["INCOMPLETE", "PRE_CONTRACT", "PENDING"] }`; GREEN; gate; commit `fix: no deadline reminders for canceled, archived, closed or expired files`.

### Task 12: Click-through with Ryan + cleanup
- [ ] Fresh test files with a dummy PDF (never real documents): a listing (edit rows, extend an Expired listing → Active), a converted transaction (fill details via pencils → automatic Pending), a lease transaction (lease dates, lease Expired), a cancellation request (reason → email + Awaiting Review → approve → listing Active/Expired).
- [ ] Afterward delete test files + R2 objects (show Ryan first), verify zero orphans.
