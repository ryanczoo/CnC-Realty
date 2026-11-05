export type FileKind = "listing" | "transaction";

const LOCKED_TRANSACTION_STATUSES = ["CLOSED", "ARCHIVED", "CANCELED_APPROVED"];
const LOCKED_LISTING_STATUSES = ["CLOSED", "CANCELED"];

// Finished files can no longer be changed by the agent. WITHDRAWN and EXPIRED
// listings stay editable because an admin can reactivate them.
export function isFileLocked(kind: FileKind, status: string | null | undefined): boolean {
  if (!status) return false;
  return (kind === "listing" ? LOCKED_LISTING_STATUSES : LOCKED_TRANSACTION_STATUSES).includes(status);
}

export function isFileReadOnlyFor(kind: FileKind, status: string | null | undefined, role: string): boolean {
  return role !== "ADMIN" && isFileLocked(kind, status);
}

// While the broker reviews a file (Awaiting Review) an agent can't change its
// commission; the broker always can. Shared by the save routes and the Overview.
export function isCommissionLockedFor(awaitingReview: boolean | null | undefined, role: string): boolean {
  return !!awaitingReview && role !== "ADMIN";
}

export const REVIEW_WAIT_MESSAGE = "Waiting for broker review";
export const PENDING_COMMISSION_MESSAGE = "Approve or reject the commission change first";

// The one status an agent may still pick while the broker reviews a file.
export function reviewExitStatus(kind: FileKind): string {
  return kind === "listing" ? "WITHDRAWN" : "CANCELED_PENDING";
}

// The statuses that finish a file; refused (any role) while a commission change is pending.
export function isFinishingStatus(kind: FileKind, toStatus: string): boolean {
  return kind === "listing"
    ? toStatus === "CLOSED" || toStatus === "CANCELED"
    : toStatus === "CLOSED" || toStatus === "CANCELED_APPROVED";
}

export function statusOptionsDuringReview(kind: FileKind, options: string[]): string[] {
  return options.filter((s) => s === reviewExitStatus(kind));
}
