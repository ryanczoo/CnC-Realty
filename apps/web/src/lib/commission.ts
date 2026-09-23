import type { TransactionSide } from "@/types/transaction";

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
}

const LEASE_SIDES = new Set(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]);

export function calcTransactionFee(input: TransactionFeeInput): TransactionFeeResult {
  const { side, salePrice, grossCommission, agentRelativeSale, brokerProvidedLead, numberOfParcels } = input;

  if (LEASE_SIDES.has(side)) {
    const fee = Math.max(grossCommission * 0.1, 200);
    return { fee, label: "CnC Lease Fee", baseFee: fee, eoSupplement: 0 };
  }

  if (brokerProvidedLead) {
    const fee = grossCommission * 0.3;
    return { fee, label: "Broker-Provided Lead Fee (30%)", baseFee: fee, eoSupplement: 0 };
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

  return { fee, label, baseFee, eoSupplement };
}

export function calcNetToAgent(
  grossCommission: number,
  transactionFee: number,
  otherDeductions: number,
  tcFeeEnabled: boolean
): number {
  return grossCommission - transactionFee - otherDeductions - (tcFeeEnabled ? TC_FEE : 0);
}
