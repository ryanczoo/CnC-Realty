# Pending Requirements Can't Be Blanked + Transaction Date Order — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** A transaction past Pre-Contract keeps what Pending needs (option A: change, never remove), and transaction dates can't be saved out of order anywhere.

**Decisions (Ryan, 2026-09-26):** Option A — once `status !== "PRE_CONTRACT"`, Acceptance Date + Close of Escrow (sale sides) / Lease Signed + Lease Start (lease sides) can't be blanked, and the side's last named client can't be removed or have its name blanked (`sidePartiesReady`). Date pairs checked on every save, any stage, whenever both dates are set: **Acceptance ≤ Close of Escrow, Offer Date ≤ Offer Expiration (LOI labels on commercial leases), Lease Signed ≤ Lease Start.** Contingency deadlines not checked. Referral files excluded. Admin follows the same rules (they're data rules; the admin Pending override is unchanged).

**Applies to:** every non-referral transaction side, residential + commercial; agent + admin (same routes). Listings unchanged (`listingDatesError` already covers them). No page-load queries; the party check adds one small read only when a transaction's buyer/seller party is renamed or removed.

## Shared pieces
- New `lib/transaction-dates.ts` → `transactionDatesError(input, saved = {}, labels?)`, mirroring `lib/listing-dates.ts`: each date comes from `input` when present, else `saved` (so the PATCH checks a new date against the stored one). Wording from `offerDateLabels`.
- `lib/transaction-wizard.ts` → `transactionDetailsReady` uses `transactionDatesError` instead of its inline comparison; the wizard shows the same message.
- `lib/file-edit.ts` → `requiredFieldError` adds the dates past Pre-Contract.
- `lib/transaction-helpers.ts` → `clientPartyError(side, status, partiesAfter)` built on `sidePartiesReady`.

## Tasks
1. `transactionDatesError` + tests; wizard gate + message switch to it.
2. `requiredFieldError` date rule + tests.
3. `clientPartyError` + tests; party PATCH/DELETE use it.
4. Routes: transactions POST + PATCH call `transactionDatesError` (PATCH only when a date is in the edit, against saved values). Route tests.
5. Gate (vitest, tsc, lint, dev log), commit; click-through list.
