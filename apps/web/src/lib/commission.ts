import { isLeaseSide, type TransactionSide } from "@/types/transaction";

export const TC_FEE = 350;

const BASE_FEE = 990;
const EO_INCLUDED_THROUGH = 1_000_000;
const EO_SUPPLEMENT_STEP = 500_000;
const EO_SUPPLEMENT_AMOUNT = 400;

export function calcEoSupplement(salePrice: number): number {
  if (salePrice <= EO_INCLUDED_THROUGH) return 0;
  return Math.ceil((salePrice - EO_INCLUDED_THROUGH) / EO_SUPPLEMENT_STEP) * EO_SUPPLEMENT_AMOUNT;
}

export interface TransactionFeeInput {
  side: TransactionSide;
  salePrice: number;
  grossCommission: number;
  agentRelativeSale: boolean;
  brokerProvidedLead: boolean;
  numberOfParcels: number | null;
}

export interface TransactionFeeResult {
  fee: number;
  label: string;
  // baseFee + eoSupplement always sum to fee. On lease and broker-provided-lead
  // files there is no base-fee/E&O split at all (different formula entirely),
  // so baseFee carries the whole fee and eoSupplement is 0 — callers that want
  // to show "CnC Transaction Fee" and "E&O Insurance" as two separate lines
  // just check `eoSupplement > 0` to decide whether a second line applies.
  baseFee: number;
  eoSupplement: number;
  // True only for the base sale-side fee formula (dual/multi-parcel eligible),
  // regardless of whether eoSupplement happens to be 0 (sale price under $1M —
  // E&O is included at no extra cost, not absent). False for lease and
  // broker-provided-lead, which have no E&O concept in their formula at all —
  // eoSupplement is 0 there too, but for a structurally different reason.
  hasEoInsurance: boolean;
}


export function calcTransactionFee(input: TransactionFeeInput): TransactionFeeResult {
  const { side, salePrice, grossCommission, agentRelativeSale, brokerProvidedLead, numberOfParcels } = input;

  if (isLeaseSide(side)) {
    const fee = Math.max(grossCommission * 0.1, 200);
    return { fee, label: "CnC Lease Fee", baseFee: fee, eoSupplement: 0, hasEoInsurance: false };
  }

  if (brokerProvidedLead) {
    // ICA §9.1's E&O coverage is unconditional ("covering real estate
    // transactions brokered through CnC Realty"); §7.9 only exempts
    // Broker-Provided Leads from the §7.2 flat-fee mechanism, not from
    // coverage itself. So E&O is still included here — free, since no
    // per-$500k supplement tiers apply to a 30%-of-gross fee.
    const fee = grossCommission * 0.3;
    return { fee, label: "Broker-Provided Lead Fee (30%)", baseFee: fee, eoSupplement: 0, hasEoInsurance: true };
  }

  const supplement = calcEoSupplement(salePrice);
  const isDual = side === "DUAL" || agentRelativeSale;
  const parcels = numberOfParcels && numberOfParcels >= 2 ? numberOfParcels : 1;
  const multiplier = (isDual ? 2 : 1) * parcels;
  const baseFee = BASE_FEE * multiplier;
  const eoSupplement = supplement * multiplier;
  const fee = baseFee + eoSupplement;

  const labelParts: string[] = [];
  if (isDual) labelParts.push("Dual ×2");
  if (parcels > 1) labelParts.push(`${parcels} Parcels`);
  const label = labelParts.length > 0 ? `CnC Transaction Fee (${labelParts.join(", ")})` : "CnC Transaction Fee";

  return { fee, label, baseFee, eoSupplement, hasEoInsurance: true };
}

export function calcNetToAgent(
  grossCommission: number,
  transactionFee: number,
  otherDeductions: number,
  tcFeeEnabled: boolean
): number {
  return grossCommission - transactionFee - otherDeductions - (tcFeeEnabled ? TC_FEE : 0);
}

export type CommissionInputs = {
  salePct: number | null;
  saleAmount: number | null;
  listingPct: number | null;
  listingAmount: number | null;
};

// Each side's commission in dollars plus the combined gross (GCI), the way the
// Commission tab reads them. A % is priced off the price (so it follows a price
// change); a flat $ is kept as entered. An agent's gross is their own side's
// commission — both sides only on Dual (lease sides use the sale fields).
export function resolveCommission(
  side: string,
  price: number,
  c: CommissionInputs,
): { saleCommissionAmount: number | null; listingCommissionAmount: number | null; commissionGCI: number | null } {
  const dollars = (pct: number | null, amount: number | null) =>
    pct ? (price * pct) / 100 : amount || null;
  const sale = dollars(c.salePct, c.saleAmount);
  const listing = dollars(c.listingPct, c.listingAmount);
  const gci =
    side === "PURCHASE" ? sale :
    side === "LISTING" ? listing :
    (sale ?? 0) + (listing ?? 0) || null;
  return { saleCommissionAmount: sale, listingCommissionAmount: listing, commissionGCI: gci };
}
