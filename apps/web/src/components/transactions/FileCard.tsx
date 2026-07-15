import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import type { FileChecklistItemWithDocs, ListingStatus, TransactionFileStatus } from "@/types/transaction";

interface Props {
  id: string;
  fileType: "listing" | "transaction";
  address: string | null;
  city: string | null;
  status: ListingStatus | TransactionFileStatus;
  closeDate?: string | null;
  listPrice?: number | null;
  checklistItems: FileChecklistItemWithDocs[];
  awaitingReview: boolean;
  referredToAgentName?: string | null;
}

export function FileCard({ id, fileType, address, city, status, closeDate, listPrice, checklistItems, awaitingReview, referredToAgentName }: Props) {
  const { satisfied, required } = getChecklistProgress(checklistItems);
  const pct = required > 0 ? Math.round((satisfied / required) * 100) : 0;

  return (
    <Link
      href={`/dashboard/transactions/${fileType}/${id}`}
      className="flex flex-col gap-3 rounded-xl border border-[#1B1B1B]/10 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {address ? (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">{address}</p>
              <p className="text-sm text-[#1B1B1B]/50">{city}, CA</p>
            </>
          ) : (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">Referral — {referredToAgentName ?? "Unnamed"}</p>
              <p className="text-sm text-[#1B1B1B]/50">Outbound referral</p>
            </>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {listPrice && (
        <p className="text-sm font-medium text-[#1B1B1B]">${listPrice.toLocaleString()}</p>
      )}

      {closeDate && (
        <p className="text-xs text-[#1B1B1B]/50">COE: {new Date(closeDate).toLocaleDateString()}</p>
      )}

      {required > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-[#1B1B1B]/50">
            <span>Checklist</span>
            <span>{satisfied}/{required}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#F2F0EF]">
            <div className="h-1.5 rounded-full bg-[#9E8C61] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {awaitingReview && (
        <span className="self-start rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
          Awaiting Review
        </span>
      )}
    </Link>
  );
}
