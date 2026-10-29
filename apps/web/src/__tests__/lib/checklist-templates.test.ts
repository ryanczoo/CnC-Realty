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
    for (const items of Object.values(T).filter(Array.isArray) as { order: number }[][]) {
      expect(orders(items)).toEqual(items.map((_, i) => i + 1));
    }
  });
});

const LPD = "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure";
const RES_EQ = "Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety)";
const COM_EQ = "Commercial Property Owner's Guide to Earthquake Safety (precast concrete or reinforced masonry buildings only)";
const WHSD = "WHSD — Water Heater & Smoke Detector Statement of Compliance (required if TDS-exempt)";
const DBD_DESC = "The Megan's Law notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract. Civil Code §2079.10a";
type Item = { name: string; description: string | null; isRequired: boolean; order: number; builtBefore?: number; skipWhenConverted?: boolean };
const named = (items: Item[], name: string) => items.filter((i) => i.name === name);
const ALL = Object.entries(T).filter(([, v]) => Array.isArray(v)) as [string, Item[]][];

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
      const items = (T as unknown as Record<string, Item[]>)[key];
      const rows = items.filter((i) => i.name.startsWith("WHSD"));
      expect(rows, key).toHaveLength(1);
      expect(rows[0]).toMatchObject({ name: WHSD, isRequired: false });
    }
  });
  it("DBD drops the paragraph numbers", () => {
    for (const [, items] of ALL) for (const i of dbd(items)) expect(i.description).toBe(DBD_DESC);
  });
});

const OLD_AD = "AD — Disclosure Regarding Real Estate Agency Relationships";
const AD_ARRAYS = [
  "RESIDENTIAL_SALE_LISTING_ITEMS", "RESIDENTIAL_SALE_BUYER_ITEMS", "RESIDENTIAL_SALE_SELLER_ITEMS",
  "RESIDENTIAL_LEASE_LISTING_ITEMS", "RESIDENTIAL_LEASE_TENANT_ITEMS", "RESIDENTIAL_LEASE_LANDLORD_ITEMS",
  "DUAL_AGENCY_ITEMS", "LEASE_DUAL_AGENCY_ITEMS", "COMMERCIAL_DUAL_ITEMS", "COMMERCIAL_LEASE_DUAL_ITEMS",
];
const RLA = "RLA — Residential Listing Agreement (Exclusive)";
const AVID = "AVID — Agent Visual Inspection Disclosure";
const LL = "LL — Lease Listing Agreement (Exclusive Authorization to Lease or Rent)";
const CLA = "CLA — Commercial/Residential Income and Vacant Land Listing Agreement";
const LEADING: Record<string, string[]> = {
  RESIDENTIAL_SALE_SELLER_ITEMS: [RLA, AVID],
  DUAL_AGENCY_ITEMS: [RLA, AVID],
  RESIDENTIAL_LEASE_LANDLORD_ITEMS: [LL],
  LEASE_DUAL_AGENCY_ITEMS: [LL],
  COMMERCIAL_LISTING_TX_ITEMS: [CLA],
  COMMERCIAL_DUAL_ITEMS: [CLA],
  COMMERCIAL_LEASE_LANDLORD_ITEMS: [CLA],
  COMMERCIAL_LEASE_DUAL_ITEMS: [CLA],
};
const get = (key: string) => (T as unknown as Record<string, Item[]>)[key];

describe("checklist templates — optional AD and listing-document rows", () => {
  it("exports AD_ITEM_NAME", () => {
    expect(T.AD_ITEM_NAME).toBe("AD — Agency Disclosure (if not already included)");
  });

  it("AD is optional, renamed, description-free on all 10 templates", () => {
    for (const key of AD_ARRAYS) {
      const rows = named(get(key), T.AD_ITEM_NAME);
      expect(rows, key).toHaveLength(1);
      expect(rows[0].isRequired, key).toBe(false);
      expect(rows[0].description, key).toBeNull();
    }
    for (const [key, items] of ALL) expect(named(items, OLD_AD), key).toEqual([]);
  });

  it("AD sits below every required item and above the other optional items", () => {
    for (const key of AD_ARRAYS) {
      const items = get(key);
      const ad = named(items, T.AD_ITEM_NAME)[0];
      for (const i of items) {
        if (i === ad) continue;
        if (i.isRequired) expect(i.order, `${key} ${i.name}`).toBeLessThan(ad.order);
        else expect(i.order, `${key} ${i.name}`).toBeGreaterThan(ad.order);
      }
    }
  });

  it("orders are 1..n with no gaps", () => {
    for (const [key, items] of ALL) expect(orders(items), key).toEqual(items.map((_, i) => i + 1));
  });

  it("listing-document rows lead the eight templates", () => {
    for (const [key, names] of Object.entries(LEADING)) {
      const head = get(key).slice(0, names.length);
      expect(head.map((i) => i.name), key).toEqual(names);
      for (const i of head) expect(i.isRequired && i.skipWhenConverted, `${key} ${i.name}`).toBe(true);
    }
  });

  it("only the listing-document rows skip on convert", () => {
    const seen = new Set<string>();
    for (const [key, items] of ALL) {
      const skipped = items.filter((i) => i.skipWhenConverted);
      if (!(key in LEADING)) expect(skipped, key).toEqual([]);
      for (const i of skipped) seen.add(i.name);
    }
    expect(Array.from(seen).sort()).toEqual([RLA, AVID, LL, CLA].sort());
  });
});
