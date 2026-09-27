import { InfoRow, type InfoRowEdit } from "./InfoRow";
import { formatDateOnly } from "@/lib/utils";
import { saveFileField, saveFileFields } from "@/lib/file-actions";
import { digitsOnly, stripDigits } from "@/lib/form-validation";
import {
  listingTypeLabel, transactionSideLabel, isLeaseSide, FILE_PROPERTY_TYPES,
  listingPriceLabel, transactionListPriceLabel, offerDateLabels, commissionDisplay,
  type ListingFileDetail, type TransactionFileDetail,
} from "@/types/transaction";

// Shared Overview tab — renders identically for agent and admin viewers of
// the same file. Extracted so both sides stay in sync automatically instead
// of drifting apart as separate implementations. With canEdit, editable rows
// get a pencil (and always show, "—" when empty, so a missing value can be
// added); State, Listing Type and Transaction Side are never editable.
export function OverviewTab({
  file, isListing, listing, transaction, progressPct, satisfied, required, canEdit = false, commissionLocked = false, onSaved,
}: {
  file: ListingFileDetail | TransactionFileDetail;
  isListing: boolean;
  listing: ListingFileDetail | null;
  transaction: TransactionFileDetail | null;
  progressPct: number;
  satisfied: number;
  required: number;
  canEdit?: boolean;
  // Agent viewing a file in broker review (isCommissionLockedFor): commission
  // rows lose their pencil; the broker's page never passes this.
  commissionLocked?: boolean;
  onSaved?: () => void;
}) {
  const isReferral = !isListing && transaction?.transactionSide === "REFERRAL";
  const isLease = !isListing && isLeaseSide(transaction?.transactionSide);
  const offerLabels = transaction ? offerDateLabels(transaction.transactionSide, transaction.propertyCategory) : null;

  const edit = (field: string, raw: unknown, opts: Partial<InfoRowEdit> = {}): InfoRowEdit | undefined =>
    canEdit
      ? {
          kind: "text",
          raw: raw == null ? "" : String(raw),
          ...opts,
          onSave: async (value) => {
            const err = await saveFileField(isListing ? "listing" : "transaction", file.id, field, value);
            if (!err) onSaved?.();
            return err;
          },
        }
      : undefined;
  // A commission pencil: the shared %/$ field; saving writes the chosen column and
  // clears the other (% and $ are separate columns). Lease commission is $ only.
  const commissionEdit = (
    pctField: string, amountField: string,
    pct: number | null | undefined, amount: number | null | undefined, flatOnly = false,
  ): InfoRowEdit | undefined =>
    canEdit && !commissionLocked
      ? {
          kind: "commission",
          hideModeToggle: flatOnly,
          mode: flatOnly || (!pct && amount) ? "flat" : "pct",
          raw: String((flatOnly || !pct ? amount : pct) ?? ""),
          onSave: async (value, mode) => {
            const flat = flatOnly || mode === "flat";
            const err = await saveFileFields(isListing ? "listing" : "transaction", file.id, {
              [pctField]: flat ? "" : value,
              [amountField]: flat ? value : "",
            });
            if (!err) onSaved?.();
            return err;
          },
        }
      : undefined;
  // Which commission rows a sale side shows — the wizard's Commission step.
  const showsSale = transaction?.transactionSide !== "LISTING";
  const showsListing = transaction?.transactionSide !== "PURCHASE";
  const dateEdit = (field: string, iso: string | null | undefined) => edit(field, iso ? iso.slice(0, 10) : "", { kind: "date" });
  const moneyEdit = (field: string, n: number | null | undefined) => edit(field, n ?? "", { kind: "currency" });
  const money = (n: number | null | undefined) => (n ? `$${Number(n).toLocaleString()}` : "—");
  const date = (d: string | null | undefined) => (d ? formatDateOnly(d) : "—");
  // Optional rows show when there's a value, or always when they can be edited.
  const show = (v: unknown) => canEdit || (v != null && v !== "");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Property Details</h2>
          <InfoRow label="Address" value={file.propertyAddress ?? "—"} edit={isReferral ? undefined : edit("propertyAddress", file.propertyAddress)} />
          <InfoRow label="City" value={file.city ?? "—"} edit={isReferral ? undefined : edit("city", file.city, { restrict: stripDigits })} />
          <InfoRow label="State" value={file.state} pencilSlot={canEdit && !isReferral} />
          <InfoRow label="ZIP" value={file.zip ?? "—"} edit={isReferral ? undefined : edit("zip", file.zip, { restrict: (v) => digitsOnly(v, 5) })} />
          {!isReferral && show(file.mlsNumber) && (
            <InfoRow label="MLS #" value={file.mlsNumber || "—"} edit={edit("mlsNumber", file.mlsNumber, { restrict: (v) => digitsOnly(v, 10) })} />
          )}
          {isListing && listing && (
            <>
              <InfoRow label={listingPriceLabel(listing.listingType)} value={money(listing.listPrice)} edit={moneyEdit("listPrice", listing.listPrice)} />
              <InfoRow label="Type" value={listingTypeLabel(listing.listingType)} pencilSlot={canEdit} />
              {show(listing.listDate) && <InfoRow label="List Date" value={date(listing.listDate)} edit={dateEdit("listDate", listing.listDate)} />}
              {show(listing.expirationDate) && <InfoRow label="Expiration" value={date(listing.expirationDate)} edit={dateEdit("expirationDate", listing.expirationDate)} />}
              {show(listing.commissionPercent ?? listing.commissionAmount) && (
                <InfoRow
                  label="Commission"
                  value={commissionDisplay(listing.commissionPercent, listing.commissionAmount)}
                  pencilSlot={canEdit} edit={commissionEdit("commissionPercent", "commissionAmount", listing.commissionPercent, listing.commissionAmount)}
                />
              )}
            </>
          )}
          {!isListing && transaction && !isReferral && (
            <>
              {show(transaction.propertyType) && (
                <InfoRow label="Property Type" value={transaction.propertyType || "—"} edit={edit("propertyType", transaction.propertyType, { kind: "select", options: FILE_PROPERTY_TYPES })} />
              )}
              {show(transaction.yearBuilt) && <InfoRow label="Year Built" value={transaction.yearBuilt ? String(transaction.yearBuilt) : "—"} edit={edit("yearBuilt", transaction.yearBuilt, { restrict: (v) => digitsOnly(v, 4) })} />}
              {!isLease && show(transaction.escrowNumber) && <InfoRow label="Escrow #" value={transaction.escrowNumber || "—"} edit={edit("escrowNumber", transaction.escrowNumber)} />}
              <InfoRow label="Transaction Side" value={transactionSideLabel(transaction.transactionSide)} pencilSlot={canEdit} />
              <InfoRow label={transactionListPriceLabel(transaction.transactionSide)} value={money(transaction.listPrice)} edit={moneyEdit("listPrice", transaction.listPrice)} />
              {isLease
                ? <InfoRow label="Total Lease Amount" value={money(transaction.leasePrice)} edit={moneyEdit("leasePrice", transaction.leasePrice)} />
                : <InfoRow label="Sale Price" value={money(transaction.salePrice)} edit={moneyEdit("salePrice", transaction.salePrice)} />}
              {show(transaction.deposit) && <InfoRow label="Deposit" value={money(transaction.deposit)} edit={moneyEdit("deposit", transaction.deposit)} />}
              {isLease ? (
                show(transaction.saleCommissionAmount) && (
                  <InfoRow label="Lease Commission" value={money(transaction.saleCommissionAmount)}
                    pencilSlot={canEdit} edit={commissionEdit("saleCommissionPct", "saleCommissionAmount", null, transaction.saleCommissionAmount, true)} />
                )
              ) : (
                <>
                  {showsSale && show(transaction.saleCommissionPct ?? transaction.saleCommissionAmount) && (
                    <InfoRow label="Selling Agent Commission" value={commissionDisplay(transaction.saleCommissionPct, transaction.saleCommissionAmount)}
                      pencilSlot={canEdit} edit={commissionEdit("saleCommissionPct", "saleCommissionAmount", transaction.saleCommissionPct, transaction.saleCommissionAmount)} />
                  )}
                  {showsListing && show(transaction.listingCommissionPct ?? transaction.listingCommissionAmount) && (
                    <InfoRow label="Listing Agent Commission" value={commissionDisplay(transaction.listingCommissionPct, transaction.listingCommissionAmount)}
                      pencilSlot={canEdit} edit={commissionEdit("listingCommissionPct", "listingCommissionAmount", transaction.listingCommissionPct, transaction.listingCommissionAmount)} />
                  )}
                </>
              )}
              {show(transaction.legalDescription) && <InfoRow label="Legal Description" value={transaction.legalDescription || "—"} edit={edit("legalDescription", transaction.legalDescription)} />}
              {show(transaction.propertyIncludes) && <InfoRow label="Property Includes" value={transaction.propertyIncludes || "—"} edit={edit("propertyIncludes", transaction.propertyIncludes)} />}
              {show(transaction.propertyExcludes) && <InfoRow label="Property Excludes" value={transaction.propertyExcludes || "—"} edit={edit("propertyExcludes", transaction.propertyExcludes)} />}
              {show(transaction.taxId) && <InfoRow label="Tax ID / APN" value={transaction.taxId || "—"} edit={edit("taxId", transaction.taxId)} />}
              {show(transaction.numberOfParcels) && (
                <InfoRow label="Multi-Parcels" value={transaction.numberOfParcels ? `${transaction.numberOfParcels} parcels` : "—"} edit={edit("numberOfParcels", transaction.numberOfParcels, { restrict: (v) => digitsOnly(v, 3) })} />
              )}
              {show(transaction.schoolDistrict) && <InfoRow label="School District" value={transaction.schoolDistrict || "—"} edit={edit("schoolDistrict", transaction.schoolDistrict)} />}
              {show(transaction.zoningClass) && <InfoRow label="Zoning Class" value={transaction.zoningClass || "—"} edit={edit("zoningClass", transaction.zoningClass)} />}
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
            {/* Offer dates: sales "Offer", commercial leases "LOI", hidden on residential leases. */}
            {offerLabels && <InfoRow label={offerLabels.date} value={date(transaction.offerDate)} edit={dateEdit("offerDate", transaction.offerDate)} />}
            {offerLabels && show(transaction.offerExpirationDate) && <InfoRow label={offerLabels.expiration} value={date(transaction.offerExpirationDate)} edit={dateEdit("offerExpirationDate", transaction.offerExpirationDate)} />}
            {isLease ? (
              <>
                <InfoRow label="Lease Signed Date" value={date(transaction.leaseSignedDate)} edit={dateEdit("leaseSignedDate", transaction.leaseSignedDate)} />
                <InfoRow label="Lease Start Date" value={date(transaction.leaseStartDate)} edit={dateEdit("leaseStartDate", transaction.leaseStartDate)} />
              </>
            ) : (
              <>
                <InfoRow label="Acceptance Date" value={date(transaction.acceptanceDate)} edit={dateEdit("acceptanceDate", transaction.acceptanceDate)} />
                <InfoRow label="Inspection Deadline" value={date(transaction.inspectionDeadline)} edit={dateEdit("inspectionDeadline", transaction.inspectionDeadline)} />
                <InfoRow label="Appraisal Deadline" value={date(transaction.appraisalDeadline)} edit={dateEdit("appraisalDeadline", transaction.appraisalDeadline)} />
                <InfoRow label="Loan Approval" value={date(transaction.loanApprovalDeadline)} edit={dateEdit("loanApprovalDeadline", transaction.loanApprovalDeadline)} />
                <InfoRow label="Close of Escrow" value={date(transaction.closeOfEscrow)} edit={dateEdit("closeOfEscrow", transaction.closeOfEscrow)} />
                {show(transaction.finalWalkthroughDate) && <InfoRow label="Final Walkthrough" value={date(transaction.finalWalkthroughDate)} edit={dateEdit("finalWalkthroughDate", transaction.finalWalkthroughDate)} />}
                {show(transaction.possessionDate) && <InfoRow label="Possession Date" value={date(transaction.possessionDate)} edit={dateEdit("possessionDate", transaction.possessionDate)} />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
