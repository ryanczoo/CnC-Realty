import { emailError } from "@/lib/form-validation";
import { listingDatesError } from "@/lib/listing-dates";
import { commissionInputError } from "@/lib/file-edit";

// New Listing wizard's per-step Next gate — the listing-side counterpart of
// the Transaction wizard's inline canAdvance. Property Info (step 0) and
// Sellers (step 1) have required fields; Commission is optional but can't be a %
// over 100; Review always advances.
export function canAdvanceListingStep(
  step: number,
  form: {
    propertyAddress: string; city: string; zip: string; listPrice: string; listingType: string;
    listDate: string; expirationDate: string; commission?: string;
  },
  sellers: { name: string; email: string }[],
  commissionMode: "pct" | "flat" = "pct",
): boolean {
  if (step === 0) {
    return (
      !!form.propertyAddress.trim() && !!form.city.trim() && !!form.zip && !!form.listPrice && !!form.listingType &&
      !listingDatesError(form.listDate, form.expirationDate)
    );
  }
  if (step === 1) {
    // Same rule as the Transaction wizard's partiesReady + partyEmailsValid:
    // at least one named seller, and only named rows' emails are checked
    // (unnamed rows are never submitted).
    return sellers.some((s) => s.name.trim()) && sellers.every((s) => !s.name.trim() || !emailError(s.email));
  }
  if (step === 2) return !commissionInputError(form.commission ?? "", commissionMode);
  return true;
}
