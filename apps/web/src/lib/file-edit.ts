import { isLeaseSide, listingPriceLabel, commissionDisplay } from "@/types/transaction";
import { isCommissionLockedFor } from "@/lib/file-lock";
import { commissionReady } from "@/lib/transaction-helpers";
import { resolveCommission, type CommissionInputs } from "@/lib/commission";

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
  acceptanceDate: "Acceptance Date", closeOfEscrow: "Close of Escrow",
  leaseSignedDate: "Lease Signed Date", leaseStartDate: "Lease Start Date",
};

type CommissionFile = {
  saleCommissionPct?: number | null; saleCommissionAmount?: number | null;
  listingCommissionPct?: number | null; listingCommissionAmount?: number | null;
};
const TX_COMMISSION = ["saleCommissionPct", "saleCommissionAmount", "listingCommissionPct", "listingCommissionAmount"] as const;
const PCT_FIELDS = ["commissionPercent", "saleCommissionPct", "listingCommissionPct"] as const;
const numOrNull = (v: unknown) => (blank(v) ? null : parseFloat(String(v)));

const LISTING_COMMISSION = ["commissionPercent", "commissionAmount"] as const;

// While the broker reviews a file (Awaiting Review), its commission is theirs to
// change — an agent's commission edit is refused (SkySlope locks it at approval).
export function commissionLockedError(
  kind: "listing" | "transaction",
  body: Record<string, unknown>,
  file: { awaitingReview?: boolean | null },
  role: string,
): string | null {
  const fields: readonly string[] = kind === "listing" ? LISTING_COMMISSION : TX_COMMISSION;
  return isCommissionLockedFor(file.awaitingReview, role) && fields.some((f) => f in body)
    ? "Commission is locked while this file is in broker review"
    : null;
}

type CommissionRow = CommissionFile & { transactionSide?: string | null; commissionPercent?: number | null; commissionAmount?: number | null };

// Each commission that differs between the saved file before and after an edit,
// in display form ("2.5%" / "$15,000") — for the Activity tab's change log.
export function commissionChanges(
  kind: "listing" | "transaction",
  before: CommissionRow,
  after: CommissionRow,
): { label: string; from: string; to: string }[] {
  const lease = isLeaseSide(before.transactionSide);
  const rows: [string, (f: CommissionRow) => string][] = kind === "listing"
    ? [["Commission", (f) => commissionDisplay(f.commissionPercent, f.commissionAmount)]]
    : [
        [lease ? "Lease Commission" : "Selling Agent Commission", (f) => commissionDisplay(lease ? null : f.saleCommissionPct, f.saleCommissionAmount)],
        ["Listing Agent Commission", (f) => commissionDisplay(f.listingCommissionPct, f.listingCommissionAmount)],
      ];
  return rows
    .map(([label, show]) => ({ label, from: show(before), to: show(after) }))
    .filter((c) => c.from !== c.to);
}

// A commission % is a share of the price — never more than all of it.
export function commissionPercentError(body: Record<string, unknown>): string | null {
  return PCT_FIELDS.some((f) => !blank(body[f]) && parseFloat(String(body[f])) > 100)
    ? "Commission can't be more than 100%"
    : null;
}

// The four commission fields as they'll stand after this edit: sent values win,
// the rest come from the saved file.
function commissionAfterEdit(body: Record<string, unknown>, file: CommissionFile): CommissionInputs {
  const pick = (f: (typeof TX_COMMISSION)[number]) => (f in body ? numOrNull(body[f]) : file[f] ?? null);
  return {
    salePct: pick("saleCommissionPct"), saleAmount: pick("saleCommissionAmount"),
    listingPct: pick("listingCommissionPct"), listingAmount: pick("listingCommissionAmount"),
  };
}

// Prisma data for a commission or price edit on a transaction: the % fields as
// sent, and each side's $ plus the GCI recomputed (lib/commission) so the
// Commission tab stays in step. Empty when the edit touches neither.
export function transactionCommissionEdit(
  body: Record<string, unknown>,
  tx: CommissionFile & { transactionSide: string; salePrice?: number | null; leasePrice?: number | null },
): Record<string, unknown> {
  const priceField = isLeaseSide(tx.transactionSide) ? "leasePrice" : "salePrice";
  if (!TX_COMMISSION.some((f) => f in body) && !(priceField in body)) return {};
  const c = commissionAfterEdit(body, tx);
  const price = priceField in body ? numOrNull(body[priceField]) : tx[priceField] ?? null;
  return { saleCommissionPct: c.salePct, listingCommissionPct: c.listingPct, ...resolveCommission(tx.transactionSide, price ?? 0, c) };
}

// The required fields the wizards enforce, which an edit may not clear.
// Listing dates are covered separately by listingDatesError. Commission and the
// Pending dates are required once a transaction is past Pre-Contract.
export function requiredFieldError(
  kind: "listing" | "transaction",
  body: Record<string, unknown>,
  file: { transactionSide?: string | null; listingType?: string | null; status?: string | null } & CommissionFile = {},
): string | null {
  let required: string[];
  if (kind === "listing") {
    required = ["propertyAddress", "city", "zip", "listPrice"];
  } else {
    if (file.transactionSide === "REFERRAL") return null;
    const lease = isLeaseSide(file.transactionSide);
    required = ["propertyAddress", "city", "zip", "propertyType", lease ? "leasePrice" : "salePrice"];
    // Past Pre-Contract the file is (or can become) Pending, which needs these
    // dates (isReadyForPending) — they can change but not be removed.
    if (file.status && file.status !== "PRE_CONTRACT") {
      required.push(...(lease ? ["leaseSignedDate", "leaseStartDate"] : ["acceptanceDate", "closeOfEscrow"]));
    }
  }
  const cleared = required.find((f) => f in body && blank(body[f]));
  const label = cleared === "listPrice" && kind === "listing" ? listingPriceLabel(file.listingType) : LABELS[cleared ?? ""];
  if (cleared) return `${label} can't be blank`;
  if (kind === "transaction" && file.status && file.status !== "PRE_CONTRACT" && TX_COMMISSION.some((f) => f in body)) {
    const side = file.transactionSide ?? "";
    const c = commissionAfterEdit(body, file);
    const hasSale = !!c.salePct || !!c.saleAmount;
    const hasListing = !!c.listingPct || !!c.listingAmount;
    if (!commissionReady(side, { hasSale, hasListing })) {
      const name = isLeaseSide(side) ? "Lease Commission" : side !== "LISTING" && !hasSale ? "Selling Agent Commission" : "Listing Agent Commission";
      return `${name} can't be blank`;
    }
  }
  return null;
}
