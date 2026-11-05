import { isReadyToClose } from "@/lib/transaction-helpers";
import { LISTING_COMMISSION, TX_COMMISSION } from "@/lib/file-edit";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

// Same shape commissionChanges() in lib/file-edit.ts returns.
export type CommissionChange = { label: string; from: string; to: string };

// A commission change an agent asked for after the broker approved a file. The file
// keeps its old commission (`before`) until the broker approves or rejects.
export type PendingCommission = {
  before: Record<string, number | null>;
  changes: CommissionChange[];
  requestedAt: string;
};

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

export function canClearReview(items: FileChecklistItemWithDocs[], pendingCommission: unknown): boolean {
  return isReadyToClose(items) && !pendingCommission;
}
