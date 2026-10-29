import { LEASE_SIDES, type TransactionSide } from "@/types/transaction";
import { builtBeforeApplies, type TemplateItemLike, type FileRowLike } from "@/lib/year-checklist";

const SALE_GROUP = ["PURCHASE", "LISTING", "DUAL"] as const satisfies readonly TransactionSide[];

// The representation choices offered when converting a listing to a transaction:
// lease listings offer landlord-only or both sides; sale listings offer seller-only or both.
export function convertSideChoices(listingType: string): ["LISTING", "DUAL"] | ["LEASE_LANDLORD", "LEASE_DUAL"] {
  return listingType === "RESIDENTIAL_LEASE" || listingType === "COMMERCIAL_LEASE"
    ? ["LEASE_LANDLORD", "LEASE_DUAL"]
    : ["LISTING", "DUAL"];
}

// The family of sides a file can switch between: sale sides together, lease sides
// together. Referral and anything unknown belong to no family.
export function representationGroup(side: string): readonly TransactionSide[] | null {
  if ((SALE_GROUP as readonly string[]).includes(side)) return SALE_GROUP;
  if ((LEASE_SIDES as readonly string[]).includes(side)) return LEASE_SIDES;
  return null;
}

// A switch is allowed only between two different sides of the same family.
export function canChangeRepresentation(from: string, to: string): boolean {
  const group = representationGroup(from);
  return !!group && from !== to && group.includes(to as TransactionSide);
}

// A converted file never gets items flagged skipWhenConverted (e.g. the listing agreement).
export function templateItemsForFile(items: TemplateItemLike[], converted: boolean): TemplateItemLike[] {
  return converted ? items.filter((i) => !i.skipWhenConverted) : items;
}

// What a representation change does to an existing checklist (rows matched to
// template items by name): add what's missing, drop empty rows no longer wanted,
// and flip required where it differs. A row holding a document is never removed.
export function planRepresentationChange(items: TemplateItemLike[], rows: FileRowLike[], yearBuilt: number | null) {
  const target = items.filter((i) => builtBeforeApplies(i.builtBefore, yearBuilt));
  const targetNames = new Set(target.map((i) => i.name));
  const add = target.filter((i) => !rows.some((r) => r.name === i.name));
  const removeIds = rows.filter((r) => !targetNames.has(r.name) && r.documentCount === 0).map((r) => r.id);
  const requiredUpdates: { id: string; isRequired: boolean }[] = [];
  for (const r of rows) {
    const t = target.find((i) => i.name === r.name);
    if (t && t.isRequired !== r.isRequired) requiredUpdates.push({ id: r.id, isRequired: t.isRequired });
  }
  return { add, removeIds, requiredUpdates };
}

// Finished files and files locked pending a transfer can't change side (the server refuses too).
const REPRESENTATION_LOCKED = new Set(["CLOSED", "CANCELED_APPROVED", "ARCHIVED", "PENDING_TRANSFER"]);

// The sides the Overview pencil offers for a file, or null when it shouldn't show one.
export function representationPencilSides(side: string, status: string): readonly TransactionSide[] | null {
  if (REPRESENTATION_LOCKED.has(status)) return null;
  return representationGroup(side);
}
