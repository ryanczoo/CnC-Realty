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
  side: string; // TransactionSide, kept as string here so this module has zero Prisma-generated imports
  salePrice: number;
  grossCommission: number;
  agentRelativeSale: boolean;
  brokerProvidedLead: boolean;
  numberOfParcels: number | null;
}

export interface TransactionFeeResult {
  fee: number;
  label: string;
}

const LEASE_SIDES = new Set(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]);

export function calcTransactionFee(input: TransactionFeeInput): TransactionFeeResult {
  const { side, salePrice, grossCommission, agentRelativeSale, brokerProvidedLead, numberOfParcels } = input;

  if (LEASE_SIDES.has(side)) {
    return { fee: Math.max(grossCommission * 0.1, 200), label: "CnC Lease Fee" };
  }

  if (brokerProvidedLead) {
    return { fee: grossCommission * 0.3, label: "Broker-Provided Lead Fee (30%)" };
  }

  const supplement = calcEoSupplement(salePrice);
  const isDual = side === "DUAL" || agentRelativeSale;
  const parcels = numberOfParcels && numberOfParcels >= 2 ? numberOfParcels : 1;
  const fee = (BASE_FEE + supplement) * (isDual ? 2 : 1) * parcels;

  const labelParts: string[] = [];
  if (isDual) labelParts.push("Dual ×2");
  if (parcels > 1) labelParts.push(`${parcels} Parcels`);
  const label = labelParts.length > 0 ? `CnC Transaction Fee (${labelParts.join(", ")})` : "CnC Transaction Fee";

  return { fee, label };
}

export function calcNetToAgent(
  grossCommission: number,
  transactionFee: number,
  otherDeductions: number,
  tcFeeEnabled: boolean
): number {
  return grossCommission - transactionFee - otherDeductions - (tcFeeEnabled ? TC_FEE : 0);
}
