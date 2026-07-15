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
  tasks: { orderBy: { createdAt: "asc" as const } },
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
  INCOMPLETE:              ["PRE_CONTRACT", "PENDING"],
  PRE_CONTRACT:            ["PENDING", "CANCELED_PENDING"],
  PENDING:                 ["CANCELED_PENDING", "REFERRAL_SUCCESSFUL", "REFERRAL_UNSUCCESSFUL"],
  EXPIRED:                 [],
  CLOSED:                  [],
  ARCHIVED:                [],
  CANCELED_PENDING:        [],
  CANCELED_APPROVED:       [],
  REFERRAL_SUCCESSFUL:     [],
  REFERRAL_UNSUCCESSFUL:   [],
  REFERRAL_BROKER_REVIEW:  [],
};

const ADMIN_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:              ["PRE_CONTRACT", "PENDING", "CANCELED_APPROVED"],
  PRE_CONTRACT:            ["PENDING", "CANCELED_PENDING", "CANCELED_APPROVED"],
  PENDING:                 ["CLOSED", "EXPIRED", "CANCELED_PENDING", "CANCELED_APPROVED"],
  EXPIRED:                 ["PENDING", "CLOSED", "CANCELED_APPROVED"],
  CLOSED:                  ["ARCHIVED"],
  ARCHIVED:                [],
  CANCELED_PENDING:        ["PENDING", "CANCELED_APPROVED"],
  CANCELED_APPROVED:       [],
  REFERRAL_SUCCESSFUL:     ["REFERRAL_BROKER_REVIEW"],
  REFERRAL_UNSUCCESSFUL:   ["CLOSED"],
  REFERRAL_BROKER_REVIEW:  ["CLOSED"],
};

export function canTransitionListing(
  from: ListingStatus,
  to: ListingStatus,
  role: ActorRole
): boolean {
  if (role === "ADMIN") {
    return (
      (ADMIN_LISTING_TRANSITIONS[from]?.includes(to) ?? false) ||
      (AGENT_LISTING_TRANSITIONS[from]?.includes(to) ?? false)
    );
  }
  return AGENT_LISTING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionTransaction(
  from: TransactionFileStatus,
  to: TransactionFileStatus,
  role: ActorRole
): boolean {
  if (role === "ADMIN") {
    return (
      (ADMIN_TX_TRANSITIONS[from]?.includes(to) ?? false) ||
      (AGENT_TX_TRANSITIONS[from]?.includes(to) ?? false)
    );
  }
  return AGENT_TX_TRANSITIONS[from]?.includes(to) ?? false;
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

export function calcReferralFee(amountReceived: number): { cncFee: number; agentNet: number } {
  const cncFee = Math.max(amountReceived * 0.10, 200);
  return { cncFee, agentNet: amountReceived - cncFee };
}
