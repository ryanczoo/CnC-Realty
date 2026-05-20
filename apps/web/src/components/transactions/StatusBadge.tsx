import type { ListingStatus, TransactionFileStatus } from "@/types/transaction";

type Status = ListingStatus | TransactionFileStatus;

const COLORS: Record<string, string> = {
  INCOMPLETE:            "bg-zinc-100 text-zinc-500",
  COMING_SOON:           "bg-blue-100 text-blue-700",
  ACTIVE:                "bg-green-100 text-green-700",
  ACTIVE_UNDER_CONTRACT: "bg-yellow-100 text-yellow-700",
  PRE_CONTRACT:          "bg-blue-100 text-blue-700",
  PENDING:               "bg-orange-100 text-orange-700",
  EXPIRED:               "bg-red-100 text-red-600",
  WITHDRAWN:             "bg-zinc-100 text-zinc-500",
  CANCELED:              "bg-red-100 text-red-600",
  CANCELED_PENDING:      "bg-red-100 text-red-500",
  CANCELED_APPROVED:     "bg-red-200 text-red-700",
  CLOSED:                "bg-[#1B1B1B] text-white",
  ARCHIVED:              "bg-zinc-200 text-zinc-600",
};

const LABELS: Record<string, string> = {
  INCOMPLETE:            "Incomplete",
  COMING_SOON:           "Coming Soon",
  ACTIVE:                "Active",
  ACTIVE_UNDER_CONTRACT: "Under Contract",
  PRE_CONTRACT:          "Pre-Contract",
  PENDING:               "Pending",
  EXPIRED:               "Expired",
  WITHDRAWN:             "Withdrawn",
  CANCELED:              "Canceled",
  CANCELED_PENDING:      "Cancel Pending",
  CANCELED_APPROVED:     "Canceled",
  CLOSED:                "Closed",
  ARCHIVED:              "Archived",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status] ?? "bg-zinc-100 text-zinc-500"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
