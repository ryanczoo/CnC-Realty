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
