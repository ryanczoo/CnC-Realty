import type {
  ListingStatus,
  TransactionFileStatus,
  ActorRole,
  FileChecklistItemWithDocs,
  ChecklistProgress,
} from "@/types/transaction";

export function toDbFileType(fileType: "listing" | "transaction"): "LISTING" | "TRANSACTION" {
  return fileType === "listing" ? "LISTING" : "TRANSACTION";
}

export const FILE_DETAIL_INCLUDE = {
  parties: true,
  checklistItems: { include: { documents: true }, orderBy: { order: "asc" as const } },
  documents: { orderBy: { uploadedAt: "desc" as const } },
  activities: {
    take: 50,
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

const AGENT_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE"],
  COMING_SOON:           ["ACTIVE", "WITHDRAWN", "CANCELED"],
  ACTIVE:                ["COMING_SOON", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED"],
  ACTIVE_UNDER_CONTRACT: ["ACTIVE", "WITHDRAWN", "CANCELED"],
  EXPIRED:               ["ACTIVE"],
  WITHDRAWN:             [],
  CANCELED:              [],
  CLOSED:                [],
};

const ADMIN_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE", "CANCELED"],
  COMING_SOON:           ["ACTIVE", "WITHDRAWN", "CANCELED"],
  ACTIVE:                ["COMING_SOON", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"],
  ACTIVE_UNDER_CONTRACT: ["ACTIVE", "CLOSED", "WITHDRAWN", "CANCELED"],
  EXPIRED:               ["ACTIVE", "CLOSED", "CANCELED"],
  WITHDRAWN:             ["ACTIVE", "CANCELED"],
  CANCELED:              [],
  CLOSED:                [],
};

const AGENT_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:        ["PRE_CONTRACT", "PENDING"],
  PRE_CONTRACT:      ["PENDING", "CANCELED_PENDING"],
  PENDING:           ["CANCELED_PENDING"],
  EXPIRED:           [],
  CLOSED:            [],
  ARCHIVED:          [],
  CANCELED_PENDING:  [],
  CANCELED_APPROVED: [],
};

const ADMIN_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:        ["PRE_CONTRACT", "PENDING", "CANCELED_APPROVED"],
  PRE_CONTRACT:      ["PENDING", "CANCELED_PENDING", "CANCELED_APPROVED"],
  PENDING:           ["CLOSED", "EXPIRED", "CANCELED_PENDING", "CANCELED_APPROVED"],
  EXPIRED:           ["PENDING", "CLOSED", "CANCELED_APPROVED"],
  CLOSED:            ["ARCHIVED"],
  ARCHIVED:          [],
  CANCELED_PENDING:  ["PENDING", "CANCELED_APPROVED"],
  CANCELED_APPROVED: [],
};

export function canTransitionListing(
  from: ListingStatus,
  to: ListingStatus,
  role: ActorRole
): boolean {
  const table = role === "ADMIN" ? ADMIN_LISTING_TRANSITIONS : AGENT_LISTING_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

export function canTransitionTransaction(
  from: TransactionFileStatus,
  to: TransactionFileStatus,
  role: ActorRole
): boolean {
  const table = role === "ADMIN" ? ADMIN_TX_TRANSITIONS : AGENT_TX_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

export function isItemSatisfied(item: FileChecklistItemWithDocs): boolean {
  return item.documents.some(
    (d) => d.reviewStatus === "APPROVED" || d.reviewStatus === "PENDING_REVIEW"
  );
}

export function getChecklistProgress(items: FileChecklistItemWithDocs[]): ChecklistProgress {
  const required = items.filter((i) => i.isRequired);
  const satisfied = required.filter(isItemSatisfied);
  return { satisfied: satisfied.length, required: required.length };
}

export function isReadyToClose(items: FileChecklistItemWithDocs[]): boolean {
  return items
    .filter((i) => i.isRequired)
    .every((i) => i.documents.some((d) => d.reviewStatus === "APPROVED"));
}
