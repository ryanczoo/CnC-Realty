import { isLeaseSide, listingPriceLabel } from "@/types/transaction";

// Detail edits (the Overview pencils) — which fields each file type accepts, how
// each is parsed, and which can never be cleared. Shared by the listing and
// transaction PATCH routes so both follow the same rules as the wizards.

const TX_TEXT = [
  "propertyAddress", "city", "zip", "mlsNumber", "propertyType", "escrowNumber",
  "legalDescription", "propertyIncludes", "propertyExcludes", "taxId", "schoolDistrict", "zoningClass",
] as const;
const TX_MONEY = ["listPrice", "salePrice", "leasePrice", "deposit"] as const;
const TX_INT = ["yearBuilt", "numberOfParcels"] as const;
const TX_DATE = [
  "offerDate", "offerExpirationDate", "acceptanceDate", "inspectionDeadline", "appraisalDeadline",
  "loanApprovalDeadline", "closeOfEscrow", "finalWalkthroughDate", "possessionDate",
  "leaseSignedDate", "leaseStartDate",
] as const;

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

// Prisma data for the editable transaction fields present in the body; blanks
// become null. Anything else (side, owner, status…) is ignored.
export function transactionEditData(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of TX_TEXT) if (f in body) data[f] = blank(body[f]) ? null : String(body[f]).trim();
  for (const f of TX_MONEY) if (f in body) data[f] = blank(body[f]) ? null : parseFloat(String(body[f]));
  for (const f of TX_INT) if (f in body) data[f] = blank(body[f]) ? null : parseInt(String(body[f]), 10);
  for (const f of TX_DATE) if (f in body) data[f] = blank(body[f]) ? null : new Date(String(body[f]));
  return data;
}

const LABELS: Record<string, string> = {
  propertyAddress: "Address", city: "City", zip: "ZIP", propertyType: "Property Type",
  salePrice: "Sale Price", leasePrice: "Total Lease Amount", listPrice: "List Price",
};

// The required fields the wizards enforce, which an edit may not clear.
// Listing dates are covered separately by listingDatesError.
export function requiredFieldError(
  kind: "listing" | "transaction",
  body: Record<string, unknown>,
  file: { transactionSide?: string | null; listingType?: string | null } = {},
): string | null {
  let required: string[];
  if (kind === "listing") {
    required = ["propertyAddress", "city", "zip", "listPrice"];
  } else {
    if (file.transactionSide === "REFERRAL") return null;
    required = ["propertyAddress", "city", "zip", "propertyType", isLeaseSide(file.transactionSide) ? "leasePrice" : "salePrice"];
  }
  const cleared = required.find((f) => f in body && blank(body[f]));
  const label = cleared === "listPrice" && kind === "listing" ? listingPriceLabel(file.listingType) : LABELS[cleared ?? ""];
  return cleared ? `${label} can't be blank` : null;
}
