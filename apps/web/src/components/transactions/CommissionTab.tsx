import { InfoRow } from "./InfoRow";
import { TC_FEE, calcNetToAgent, calcTransactionFee } from "@/lib/commission";
import type { TransactionFileDetail } from "@/types/transaction";

const LEASE_SIDES = ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"];

// Shared Commission tab — renders identically for agent and admin viewers of
// the same file. Extracted so both sides stay in sync automatically instead
// of drifting apart as separate implementations.
export function CommissionTab({ transaction }: { transaction: TransactionFileDetail }) {
  const isLeaseSide = LEASE_SIDES.includes(transaction.transactionSide);
  const salePrice = Number(transaction.salePrice ?? 0);
  const leasePrice = Number(transaction.leasePrice ?? 0);
  const salePct = Number(transaction.saleCommissionPct ?? 0);
  const listingPct = Number(transaction.listingCommissionPct ?? 0);
  const deductions = Number(transaction.otherDeductions ?? 0);

  // Read the actual dollar amount stored per side at creation — set
  // regardless of whether the agent used % or $ entry mode, so this is
  // correct in both cases (unlike recomputing from salePct/listingPct,
  // which is only ever populated when % mode was used).
  const saleCommissionDollar = Number(transaction.saleCommissionAmount ?? 0);
  const listingCommissionDollar = Number(transaction.listingCommissionAmount ?? 0);
  // commissionGCI is the combined gross commission total (both sides summed
  // for Dual, a single side's amount otherwise) — used for the Net to Agent
  // panel's math, which never needs the per-side split.
  const totalGross = Number(transaction.commissionGCI ?? 0);
  const transactionFee = calcTransactionFee({
    side: transaction.transactionSide,
    salePrice,
    grossCommission: totalGross,
    agentRelativeSale: transaction.agentRelativeSale,
    brokerProvidedLead: transaction.brokerProvidedLead,
    numberOfParcels: transaction.numberOfParcels,
  });
  const netToAgent = calcNetToAgent(totalGross, transactionFee.fee, deductions, transaction.tcFeeEnabled);

  const fmt = (n: number) => n !== 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const fmtPct = (n: number) => n !== 0 ? `${n}%` : "—";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Commission Breakdown</h2>
        <InfoRow
          label={isLeaseSide ? "Total Lease Amount" : "Sale Price"}
          value={(isLeaseSide ? leasePrice : salePrice) > 0 ? `$${(isLeaseSide ? leasePrice : salePrice).toLocaleString()}` : "—"}
        />
        {transaction.deposit && <InfoRow label="Deposit" value={`$${Number(transaction.deposit).toLocaleString()}`} />}
        {isLeaseSide ? (
          <InfoRow label="Lease Commission $" value={fmt(totalGross)} />
        ) : (
          <>
            {transaction.transactionSide !== "LISTING" && (
              <>
                <InfoRow label="Selling Agent Commission" value={fmtPct(salePct)} />
                <InfoRow label="Selling Agent Commission $" value={fmt(saleCommissionDollar)} />
              </>
            )}
            {transaction.transactionSide !== "PURCHASE" && (
              <>
                <InfoRow label="Listing Agent Commission" value={fmtPct(listingPct)} />
                <InfoRow label="Listing Agent Commission $" value={fmt(listingCommissionDollar)} />
              </>
            )}
          </>
        )}
        <InfoRow label={transactionFee.label} value={transactionFee.baseFee > 0 ? `-${fmt(transactionFee.baseFee)}` : "—"} />
        {transactionFee.hasEoInsurance && (
          <InfoRow label="E&O Insurance" value={transactionFee.eoSupplement > 0 ? `-${fmt(transactionFee.eoSupplement)}` : "FREE"} />
        )}
        <InfoRow label="Other Deductions" value={deductions > 0 ? `-${fmt(deductions)}` : "—"} />
        {transaction.tcFeeEnabled && (
          <InfoRow label="CnC TC Service" value={`-${fmt(TC_FEE)}`} />
        )}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Net to Agent</h2>
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">Gross Commission</span>
          <span className="font-medium text-[#1B1B1B]">{fmt(totalGross)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">{transactionFee.label}</span>
          <span className="font-medium text-red-500">{transactionFee.fee > 0 ? `-${fmt(transactionFee.fee)}` : "—"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">Deductions</span>
          <span className="font-medium text-red-500">{deductions > 0 ? `-${fmt(deductions)}` : "—"}</span>
        </div>
        {transaction.tcFeeEnabled && (
          <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
            <span className="text-sm text-[#1B1B1B]/50">CnC TC Service</span>
            <span className="font-medium text-red-500">-{fmt(TC_FEE)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-semibold text-[#1B1B1B]">Net to Agent</span>
          <span className="text-xl font-light text-[#9E8C61]">{fmt(netToAgent)}</span>
        </div>
        {transaction.commissionNotes && (
          <p className="mt-2 text-xs text-[#1B1B1B]/40 border-t border-[#1B1B1B]/5 pt-3">{transaction.commissionNotes}</p>
        )}
      </div>
    </div>
  );
}
