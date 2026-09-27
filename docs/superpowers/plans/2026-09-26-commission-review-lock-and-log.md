# Commission Review Lock + Change Log — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Agents can edit commission until they Submit for Review; while a file is Awaiting Review only an admin can change it; every commission change is recorded in the Activity tab (old → new, who).

**Decisions (Ryan, 2026-09-26, SkySlope as reference):** SkySlope locks commission at broker approval (around the CDA). CnC's equivalent moment is Submit for Review — for a transaction, during escrow once its file is complete; for a listing, while the listing agreement is reviewed. Applies to **listings and transactions** (all sides), **agent and admin** (admin is never locked). Migration approved.

**No page-load cost:** the lock reads `awaitingReview`, already loaded on the file page; the log is one insert only when a save actually changes commission.

## Tasks

1. **Migration** `20260926140000_add_commission_changed_activity`: `ALTER TYPE "FileActivityType" ADD VALUE 'COMMISSION_CHANGED';` (schema enum too). migrate status → deploy → stop only the Next dev process on :3000 → `prisma generate` → restart dev.
2. **Shared rules** (TDD):
   - `lib/file-lock.ts`: `isCommissionLockedFor(awaitingReview, role)` — true only for a non-admin while Awaiting Review.
   - `lib/file-edit.ts`: `commissionLockedError(kind, body, file, role)` → "Commission is locked while this file is in broker review" when the body touches a commission field of that kind and the lock applies; `commissionChanges(kind, before, after)` → `{ label, from, to }[]` using `commissionDisplay` (listing "Commission"; transaction "Selling Agent Commission" / "Listing Agent Commission" / "Lease Commission").
   - `lib/activity-detail.ts`: `describeActivity` for `COMMISSION_CHANGED` → "Selling Agent Commission: 2.5% → $15,000"; `ActivityFeed` label "Commission changed".
3. **Routes** (TDD): listing and transaction PATCH refuse a locked commission edit (403), and after saving write one `COMMISSION_CHANGED` activity when `commissionChanges` is non-empty (payload `{ changes }`, actor + role).
4. **UI:** `OverviewTab` prop `commissionLocked` hides the commission pencils (keeps the pencil slot for alignment); agent page passes `isCommissionLockedFor(file.awaitingReview, role)`; admin page never locks.
5. Gate (vitest, tsc, lint, dev log), commit; Ryan clicks through one listing + one transaction.
