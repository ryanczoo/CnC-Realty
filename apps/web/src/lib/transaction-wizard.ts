import { transactionDatesError } from "@/lib/transaction-dates";

// New Transaction wizard, Step 2 (Transaction Details) Next gate — the
// transaction-side counterpart of listing-wizard.ts. An Under Contract file is a
// ratified contract, so its key dates are known and required (they're what
// isReadyForPending needs); a Pre-Contract file only needs its price. At any
// stage the dates entered must be in order (the shared transactionDatesError).
export function transactionDetailsReady(
  form: {
    salePrice: string; leasePrice: string; acceptanceDate: string; closeOfEscrow: string;
    leaseSignedDate: string; leaseStartDate: string; offerDate?: string; offerExpirationDate?: string;
  },
  stage: string,
  isLease: boolean,
): boolean {
  const price = isLease ? form.leasePrice : form.salePrice;
  if (!price || transactionDatesError(form)) return false;
  if (stage === "PRE_CONTRACT") return true;
  return isLease ? !!form.leaseSignedDate && !!form.leaseStartDate : !!form.acceptanceDate && !!form.closeOfEscrow;
}
