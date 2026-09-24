import { InfoRow } from "./InfoRow";
import { formatDateOnly } from "@/lib/utils";
import type { ListingFileDetail, TransactionFileDetail } from "@/types/transaction";

// Shared Overview tab — renders identically for agent and admin viewers of
// the same file. Extracted so both sides stay in sync automatically instead
// of drifting apart as separate implementations.
export function OverviewTab({
  file, isListing, listing, transaction, progressPct, satisfied, required,
}: {
  file: ListingFileDetail | TransactionFileDetail;
  isListing: boolean;
  listing: ListingFileDetail | null;
  transaction: TransactionFileDetail | null;
  progressPct: number;
  satisfied: number;
  required: number;
}) {
  const isReferral = !isListing && transaction?.transactionSide === "REFERRAL";
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Property Details</h2>
          <InfoRow label="Address" value={file.propertyAddress ?? "—"} />
          <InfoRow label="City" value={file.city ?? "—"} />
          <InfoRow label="State" value={file.state} />
          <InfoRow label="ZIP" value={file.zip ?? "—"} />
          {file.mlsNumber && <InfoRow label="MLS #" value={file.mlsNumber} />}
          {isListing && listing && (
            <>
              <InfoRow label="List Price" value={listing.listPrice ? `$${Number(listing.listPrice).toLocaleString()}` : "—"} />
              <InfoRow label="Type" value={listing.listingType ?? "—"} />
              {listing.listDate && <InfoRow label="List Date" value={formatDateOnly(listing.listDate)} />}
              {listing.expirationDate && <InfoRow label="Expiration" value={formatDateOnly(listing.expirationDate)} />}
              {listing.commissionPercent && <InfoRow label="Commission" value={`${listing.commissionPercent}%`} />}
            </>
          )}
          {!isListing && transaction && !isReferral && (
            <>
              {transaction.propertyType && <InfoRow label="Property Type" value={transaction.propertyType} />}
              {transaction.yearBuilt && <InfoRow label="Year Built" value={String(transaction.yearBuilt)} />}
              {transaction.escrowNumber && <InfoRow label="Escrow #" value={transaction.escrowNumber} />}
              <InfoRow label="Transaction Side" value={transaction.transactionSide ?? "—"} />
              <InfoRow label="List Price" value={transaction.listPrice ? `$${Number(transaction.listPrice).toLocaleString()}` : "—"} />
              <InfoRow label="Sale Price" value={transaction.salePrice ? `$${Number(transaction.salePrice).toLocaleString()}` : "—"} />
              {transaction.leasePrice && <InfoRow label="Total Lease Amount" value={`$${Number(transaction.leasePrice).toLocaleString()}`} />}
              {transaction.legalDescription && <InfoRow label="Legal Description" value={transaction.legalDescription} />}
              {transaction.propertyIncludes && <InfoRow label="Property Includes" value={transaction.propertyIncludes} />}
              {transaction.propertyExcludes && <InfoRow label="Property Excludes" value={transaction.propertyExcludes} />}
              {transaction.taxId && <InfoRow label="Tax ID / APN" value={transaction.taxId} />}
              {transaction.numberOfParcels && <InfoRow label="Multi-Parcels" value={`${transaction.numberOfParcels} parcels`} />}
              {transaction.schoolDistrict && <InfoRow label="School District" value={transaction.schoolDistrict} />}
              {transaction.zoningClass && <InfoRow label="Zoning Class" value={transaction.zoningClass} />}
            </>
          )}
        </div>

        {isReferral && transaction && (
          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Referral Details</h2>
            <InfoRow label="Referred-To Agent" value={transaction.referredToAgentName ?? "—"} />
            <InfoRow label="Referred-To Brokerage" value={transaction.referredToBrokerageName ?? "—"} />
            <InfoRow label="Contact Email" value={transaction.referredToContactEmail ?? "—"} />
            <InfoRow label="Contact Phone" value={transaction.referredToContactPhone ?? "—"} />
            <InfoRow label="Date Referred" value={transaction.dateReferred ? formatDateOnly(transaction.dateReferred) : "—"} />
            {transaction.referralAmountReceived != null && (
              <>
                <InfoRow label="Referral Amount Received" value={`$${Number(transaction.referralAmountReceived).toLocaleString()}`} />
                <InfoRow label="CnC Fee" value={transaction.referralCncFee != null ? `$${Number(transaction.referralCncFee).toLocaleString()}` : "—"} />
                <InfoRow label="Agent Net" value={`$${(Number(transaction.referralAmountReceived) - Number(transaction.referralCncFee ?? 0)).toLocaleString()}`} />
              </>
            )}
          </div>
        )}

        {!isListing && transaction && !isReferral && transaction.photoKey && (
          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Property Photo</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/transactions/${file.id}/photo`} alt="Property" className="w-full rounded-lg object-cover" />
          </div>
        )}

        {!isListing && transaction && !isReferral && transaction.conditions.length > 0 && (
          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Contingencies</h2>
            {transaction.conditions.map((c) => (
              <div key={c.id} className="border-b border-[#1B1B1B]/5 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#1B1B1B]">{c.name}</span>
                  {c.dueDate && <span className="text-xs text-[#1B1B1B]/50">{formatDateOnly(c.dueDate)}</span>}
                </div>
                {c.notes && <p className="text-xs text-[#1B1B1B]/40">{c.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Checklist Progress</h2>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-light text-[#1B1B1B]">{progressPct}%</span>
            <span className="text-sm text-[#1B1B1B]/50">{satisfied} / {required} required</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#F2F0EF]">
            <div className="h-full rounded-full bg-[#9E8C61] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {!isListing && transaction && !isReferral && (
          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Key Dates</h2>
            <InfoRow label="Offer Date" value={transaction.offerDate ? formatDateOnly(transaction.offerDate) : "—"} />
            <InfoRow label="Acceptance Date" value={transaction.acceptanceDate ? formatDateOnly(transaction.acceptanceDate) : "—"} />
            <InfoRow label="Inspection Deadline" value={transaction.inspectionDeadline ? formatDateOnly(transaction.inspectionDeadline) : "—"} />
            <InfoRow label="Appraisal Deadline" value={transaction.appraisalDeadline ? formatDateOnly(transaction.appraisalDeadline) : "—"} />
            <InfoRow label="Loan Approval" value={transaction.loanApprovalDeadline ? formatDateOnly(transaction.loanApprovalDeadline) : "—"} />
            <InfoRow label="Close of Escrow" value={transaction.closeOfEscrow ? formatDateOnly(transaction.closeOfEscrow) : "—"} />
            {transaction.offerExpirationDate && <InfoRow label="Offer Expiration" value={formatDateOnly(transaction.offerExpirationDate)} />}
            {transaction.finalWalkthroughDate && <InfoRow label="Final Walkthrough" value={formatDateOnly(transaction.finalWalkthroughDate)} />}
            {transaction.possessionDate && <InfoRow label="Possession Date" value={formatDateOnly(transaction.possessionDate)} />}
          </div>
        )}
      </div>
    </div>
  );
}
