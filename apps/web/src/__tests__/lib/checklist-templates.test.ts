import { describe, it, expect } from "vitest";
import * as T from "../../../../../packages/database/prisma/checklist-templates";

// Civil Code §2079.10a puts the Megan's Law notice in the sale contract itself, and C.A.R.
// pre-prints it in the RPA and RIPA: a separate DBD is needed only with another contract.
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

const LPD = "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure";
const RES_EQ = "Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety)";
const COM_EQ = "Commercial Property Owner's Guide to Earthquake Safety (precast concrete or reinforced masonry buildings only)";
const WHSD = "WHSD — Water Heater & Smoke Detector Statement of Compliance (required if TDS-exempt)";
const DBD_DESC = "The Megan's Law notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract. Civil Code §2079.10a";
type Item = { name: string; description: string; isRequired: boolean; order: number; builtBefore?: number };
const named = (items: Item[], name: string) => items.filter((i) => i.name === name);
const ALL = Object.entries(T) as [string, Item[]][];

const RES_SALE = ["RESIDENTIAL_SALE_LISTING_ITEMS", "RESIDENTIAL_SALE_BUYER_ITEMS", "RESIDENTIAL_SALE_SELLER_ITEMS", "DUAL_AGENCY_ITEMS"];
const RES_LEASE = ["RESIDENTIAL_LEASE_LISTING_ITEMS", "RESIDENTIAL_LEASE_TENANT_ITEMS", "RESIDENTIAL_LEASE_LANDLORD_ITEMS", "LEASE_DUAL_AGENCY_ITEMS"];
const COM_SALE = ["COMMERCIAL_SALE_LISTING_ITEMS", "COMMERCIAL_PURCHASE_ITEMS", "COMMERCIAL_LISTING_TX_ITEMS", "COMMERCIAL_DUAL_ITEMS"];

describe("checklist templates — year-based items", () => {
  it("LPD (built before 1978, required) is on every residential sale and lease checklist, once", () => {
    for (const [key, items] of ALL) {
      const rows = named(items, LPD);
      if ([...RES_SALE, ...RES_LEASE].includes(key)) {
        expect(rows, key).toHaveLength(1);
        expect(rows[0]).toMatchObject({ isRequired: true, builtBefore: 1978 });
      } else {
        expect(rows, key).toEqual([]);
      }
    }
  });
  it("the residential earthquake report (before 1960, required) is on residential sales only", () => {
    for (const [key, items] of ALL) {
      const rows = named(items, RES_EQ);
      if (RES_SALE.includes(key)) expect(rows[0], key).toMatchObject({ isRequired: true, builtBefore: 1960 });
      else expect(rows, key).toEqual([]);
    }
  });
  it("the commercial earthquake guide (before 1975, optional) is on commercial sales only", () => {
    for (const [key, items] of ALL) {
      const rows = named(items, COM_EQ);
      if (COM_SALE.includes(key)) expect(rows[0], key).toMatchObject({ isRequired: false, builtBefore: 1975 });
      else expect(rows, key).toEqual([]);
    }
  });
  it("only the three year-based items carry a built-before year", () => {
    for (const [key, items] of ALL) {
      for (const i of items) if (i.builtBefore != null) expect([LPD, RES_EQ, COM_EQ], key).toContain(i.name);
    }
  });
});

describe("checklist templates — WHSD and DBD wording", () => {
  it("WHSD is optional and named for when it applies", () => {
    for (const key of ["RESIDENTIAL_SALE_LISTING_ITEMS", "RESIDENTIAL_SALE_SELLER_ITEMS", "DUAL_AGENCY_ITEMS"]) {
      const items = (T as Record<string, Item[]>)[key];
      const rows = items.filter((i) => i.name.startsWith("WHSD"));
      expect(rows, key).toHaveLength(1);
      expect(rows[0]).toMatchObject({ name: WHSD, isRequired: false });
    }
  });
  it("DBD drops the paragraph numbers", () => {
    for (const [, items] of ALL) for (const i of dbd(items)) expect(i.description).toBe(DBD_DESC);
  });
});
