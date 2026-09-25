// New Transaction wizard, Step 2 (Transaction Details) Next gate — the
// transaction-side counterpart of listing-wizard.ts. An Under Contract file is a
// ratified contract, so its key dates are known and required (they're what
// isReadyForPending needs); a Pre-Contract file only needs its price.
export function transactionDetailsReady(
  form: { salePrice: string; leasePrice: string; acceptanceDate: string; closeOfEscrow: string; leaseSignedDate: string; leaseStartDate: string },
  stage: string,
  isLease: boolean,
): boolean {
  const price = isLease ? form.leasePrice : form.salePrice;
  if (!price) return false;
  if (stage === "PRE_CONTRACT") return true;
  if (isLease) return !!form.leaseSignedDate && !!form.leaseStartDate;
  // DateField values are "YYYY-MM-DD", so string order is date order.
  return !!form.acceptanceDate && !!form.closeOfEscrow && form.closeOfEscrow >= form.acceptanceDate;
}
