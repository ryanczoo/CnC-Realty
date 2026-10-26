import { emailError } from "@/lib/form-validation";
import { listingDatesError } from "@/lib/listing-dates";
import { commissionInputError } from "@/lib/file-edit";
import { yearBuiltError } from "@/lib/year-built";

// New Listing wizard's per-step Next gate — the listing-side counterpart of
// the Transaction wizard's inline canAdvance. Listing Type (step 0), Listing
// Info (step 1) and Sellers (step 2) have required fields; Commission (step 3)
// is optional but can't be a % over 100; Review always advances.
export function canAdvanceListingStep(
  step: number,
  form: {
    propertyAddress: string; city: string; zip: string; listPrice: string; listingType: string;
    listDate: string; expirationDate: string; commission?: string; propertyType?: string; yearBuilt?: string;
  },
  sellers: { name: string; email: string }[],
  commissionMode: "pct" | "flat" = "pct",
): boolean {
  if (step === 0) return !!form.listingType;
  if (step === 1) {
    return (
      !!form.propertyAddress.trim() && !!form.city.trim() && !!form.zip && !!form.listPrice && !!form.listingType &&
      !!form.propertyType && !yearBuiltError(form.yearBuilt ?? "", form.propertyType) &&
      !listingDatesError(form.listDate, form.expirationDate)
    );
  }
  if (step === 2) {
    // Same rule as the Transaction wizard's partiesReady + partyEmailsValid:
    // at least one named seller, and only named rows' emails are checked
    // (unnamed rows are never submitted).
    return sellers.some((s) => s.name.trim()) && sellers.every((s) => !s.name.trim() || !emailError(s.email));
  }
  if (step === 3) return !commissionInputError(form.commission ?? "", commissionMode);
  return true;
}
