import { isReadyToClose } from "@/lib/transaction-helpers";
import { LISTING_COMMISSION, TX_COMMISSION } from "@/lib/file-edit";
import type { CommissionChange, FileChecklistItemWithDocs, PendingCommission } from "@/types/transaction";

export function commissionFields(kind: "listing" | "transaction"): readonly string[] {
  return kind === "listing" ? LISTING_COMMISSION : TX_COMMISSION;
}

export function buildPendingCommission(
  kind: "listing" | "transaction",
  before: Record<string, unknown>,
  changes: CommissionChange[],
  now: Date,
): PendingCommission {
  const kept: Record<string, number | null> = {};
  for (const f of commissionFields(kind)) {
    const v = before[f];
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("Commission must be a number");
    kept[f] = typeof v === "number" ? v : null;
  }
  return { before: kept, changes, requestedAt: now.toISOString() };
}

// True once a file has been submitted for review and the broker has cleared it.
export function isAfterReview(file: {
  reviewSubmittedAt?: Date | string | null;
  awaitingReview?: boolean | null;
}): boolean {
  return !!file.reviewSubmittedAt && !file.awaitingReview;
}

// The one "is a commission change waiting for the broker" check. A stored value
// only counts when it lists at least one change; null, {} or an empty list don't.
export function hasPendingCommission(p: unknown): p is PendingCommission {
  const changes = (p as { changes?: unknown } | null | undefined)?.changes;
  return Array.isArray(changes) && changes.length > 0;
}

export function canClearReview(items: FileChecklistItemWithDocs[], pendingCommission: unknown): boolean {
  return isReadyToClose(items) && !hasPendingCommission(pendingCommission);
}
