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

// The lighter-weight sibling of FILE_DETAIL_INCLUDE.checklistItems, used by
// routes that only need checklist completion status (not the full file
// detail page's ordering) — independently written in 6 places before this,
// now the single source of truth for that shape.
export const CHECKLIST_ITEMS_WITH_DOCS_INCLUDE = { include: { documents: true } } as const;

// A checklist row's documents come back in no guaranteed order; the row's
// status must follow the most recently uploaded one.
export function latestDocument<T extends { uploadedAt?: string | Date }>(docs: readonly T[]): T | undefined {
  const time = (d: T) => (d.uploadedAt ? new Date(d.uploadedAt).getTime() : 0);
  return docs.reduce<T | undefined>((latest, d) => (!latest || time(d) > time(latest) ? d : latest), undefined);
}

const AGENT_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE"],
  PENDING_TRANSFER:      [],
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
  PENDING_TRANSFER:      [],
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
  PENDING_TRANSFER:        [],
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
  PENDING_TRANSFER:        [],
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

// The moves the server will accept from a status, read from the same tables
// as canTransition*, so a dropdown built from this can never offer a move the
// server rejects.
export function allowedNextStatuses(
  kind: "listing" | "transaction",
  from: string,
  role: ActorRole
): string[] {
  const agentTable = (kind === "listing" ? AGENT_LISTING_TRANSITIONS : AGENT_TX_TRANSITIONS) as Record<string, string[]>;
  const adminTable = (kind === "listing" ? ADMIN_LISTING_TRANSITIONS : ADMIN_TX_TRANSITIONS) as Record<string, string[]>;
  const tables = role === "ADMIN" ? [adminTable, agentTable] : [agentTable];
  const next = new Set<string>();
  for (const table of tables) for (const status of table[from] ?? []) next.add(status);
  return [...next];
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

// The price a file card should show. A transaction's sale price is the price it
// went under contract for, so it wins over the list price. Listing files only
// ever have a list price.
export function pickDisplayPrice(
  fileType: "listing" | "transaction",
  prices: { listPrice?: number | null; salePrice?: number | null }
): number | null {
  if (fileType === "transaction") return prices.salePrice ?? prices.listPrice ?? null;
  return prices.listPrice ?? null;
}

export type EscrowContactType = "Title" | "Escrow" | "Attorney";

const ESCROW_ROLE_BY_TYPE = { Title: "TITLE", Escrow: "ESCROW", Attorney: "ATTORNEY" } as const;

// The wizard's Title / Escrow / Attorney choice is the party's role, so the
// Company field stays free for the company name the agent typed.
export function escrowTypeToRole(type: EscrowContactType): "TITLE" | "ESCROW" | "ATTORNEY" {
  return ESCROW_ROLE_BY_TYPE[type];
}
