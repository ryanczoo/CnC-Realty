import type { Prisma } from "@cnc/database";

// Which checklist template a file gets — one rule shared by every place that
// creates checklist rows (create, convert, deal convert, transfer unlock) and by
// the Year Built re-check. Listings match on listing type; transactions on side
// plus residential/commercial (anything not COMMERCIAL counts as RESIDENTIAL).
export function checklistTemplateWhere(kind: "listing", f: { listingType: string }): Prisma.ChecklistTemplateWhereInput;
export function checklistTemplateWhere(kind: "transaction", f: { transactionSide: string; propertyCategory?: string | null }): Prisma.ChecklistTemplateWhereInput;
export function checklistTemplateWhere(
  kind: "listing" | "transaction",
  f: { listingType?: string; transactionSide?: string; propertyCategory?: string | null },
): Prisma.ChecklistTemplateWhereInput {
  if (kind === "listing") {
    return { fileType: "LISTING", isActive: true, OR: [{ listingType: f.listingType }, { listingType: "ALL" }] };
  }
  const category = f.propertyCategory === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL";
  return {
    fileType: "TRANSACTION",
    isActive: true,
    OR: [{ transactionSide: f.transactionSide }, { transactionSide: "ALL" }],
    AND: [{ OR: [{ propertyCategory: category }, { propertyCategory: "ALL" }] }],
  };
}
