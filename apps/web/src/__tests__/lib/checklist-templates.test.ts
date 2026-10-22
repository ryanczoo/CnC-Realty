import { describe, it, expect } from "vitest";
import * as T from "../../../../../packages/database/prisma/checklist-templates";

// Civil Code §2079.10a puts the Megan's Law notice in the sale contract itself, and C.A.R.
// pre-prints it (RPA ¶10(D), RIPA ¶11(C)): "A separate form DBD is typically not required."
const DBD_OPTIONAL = "DBD — Megan's Law Database Disclosure (Required if not using C.A.R. RPA/RIPA)";
const dbd = <I extends { name: string }>(items: I[]) => items.filter((i) => i.name.startsWith("DBD"));
const orders = (items: { order: number }[]) => items.map((i) => i.order);

describe("checklist templates — Megan's Law (DBD)", () => {
  it("no listing checklist asks for DBD (there is no purchase contract yet)", () => {
    for (const items of [T.RESIDENTIAL_SALE_LISTING_ITEMS, T.RESIDENTIAL_LEASE_LISTING_ITEMS, T.COMMERCIAL_SALE_LISTING_ITEMS, T.COMMERCIAL_LEASE_LISTING_ITEMS]) {
      expect(dbd(items)).toEqual([]);
    }
  });

  it.each([
    ["residential purchase", T.RESIDENTIAL_SALE_BUYER_ITEMS],
    ["residential listing side", T.RESIDENTIAL_SALE_SELLER_ITEMS],
    ["residential dual agency", T.DUAL_AGENCY_ITEMS],
  ])("%s has DBD as an optional item, named for when it applies", (_label, items) => {
    const rows = dbd(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(DBD_OPTIONAL);
    expect(rows[0].isRequired).toBe(false);
  });

  it("leases, referrals and commercial transactions don't carry DBD", () => {
    for (const items of [T.RESIDENTIAL_LEASE_TENANT_ITEMS, T.RESIDENTIAL_LEASE_LANDLORD_ITEMS, T.LEASE_DUAL_AGENCY_ITEMS, T.REFERRAL_ITEMS, T.COMMERCIAL_PURCHASE_ITEMS, T.COMMERCIAL_LISTING_TX_ITEMS, T.COMMERCIAL_DUAL_ITEMS, T.COMMERCIAL_LEASE_TENANT_ITEMS, T.COMMERCIAL_LEASE_LANDLORD_ITEMS, T.COMMERCIAL_LEASE_DUAL_ITEMS]) {
      expect(dbd(items)).toEqual([]);
    }
  });

  it("every checklist is numbered 1, 2, 3… with no gaps", () => {
    for (const items of Object.values(T)) {
      expect(orders(items)).toEqual(items.map((_, i) => i + 1));
    }
  });
});
