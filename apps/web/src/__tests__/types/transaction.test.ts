import { describe, it, expect } from "vitest";
import { listingTypeLabel, transactionSideLabel, isLeaseSide, listingPriceLabel, transactionListPriceLabel, offerDateLabels, commissionDisplay } from "@/types/transaction";

describe("listingTypeLabel", () => {
  it.each([
    ["RESIDENTIAL_SALE", "Residential Sale"],
    ["RESIDENTIAL_LEASE", "Residential Lease"],
    ["COMMERCIAL_SALE", "Commercial Sale"],
    ["COMMERCIAL_LEASE", "Commercial Lease"],
  ])("labels %s as %s", (value, label) => {
    expect(listingTypeLabel(value)).toBe(label);
  });

  it("falls back to an em dash for a missing or unknown value", () => {
    expect(listingTypeLabel(null)).toBe("—");
    expect(listingTypeLabel("")).toBe("—");
    expect(listingTypeLabel("SOMETHING_ELSE")).toBe("—");
  });
});

describe("transactionSideLabel", () => {
  it.each([
    ["PURCHASE", "Purchase"],
    ["LISTING", "Listing"],
    ["DUAL", "Both Purchase & Listing"],
    ["LEASE_TENANT", "Lease Tenant"],
    ["LEASE_LANDLORD", "Lease Landlord"],
    ["LEASE_DUAL", "Both Lease Tenant & Landlord"],
    ["REFERRAL", "Referral"],
  ])("labels %s as %s", (value, label) => {
    expect(transactionSideLabel(value)).toBe(label);
  });

  it("falls back to an em dash for a missing or unknown value", () => {
    expect(transactionSideLabel(null)).toBe("—");
    expect(transactionSideLabel("")).toBe("—");
    expect(transactionSideLabel("SOMETHING_ELSE")).toBe("—");
  });
});

describe("isLeaseSide", () => {
  it.each(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"])("treats %s as a lease", (s) => {
    expect(isLeaseSide(s)).toBe(true);
  });

  it.each(["PURCHASE", "LISTING", "DUAL", "REFERRAL", "", null])("does not treat %j as a lease", (s) => {
    expect(isLeaseSide(s)).toBe(false);
  });
});

describe("listingPriceLabel", () => {
  it.each(["RESIDENTIAL_LEASE", "COMMERCIAL_LEASE"])("calls a %s listing's price the Monthly Rent", (t) => {
    expect(listingPriceLabel(t)).toBe("Monthly Rent");
  });
  it.each(["RESIDENTIAL_SALE", "COMMERCIAL_SALE", "", null])("keeps List Price for %j", (t) => {
    expect(listingPriceLabel(t)).toBe("List Price");
  });
});

describe("transactionListPriceLabel", () => {
  it.each(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"])("shows %s's list-price field as Monthly Rent", (s) => {
    expect(transactionListPriceLabel(s)).toBe("Monthly Rent");
  });
  it.each(["PURCHASE", "LISTING", "DUAL"])("keeps List Price for %s", (s) => {
    expect(transactionListPriceLabel(s)).toBe("List Price");
  });
});

describe("offerDateLabels", () => {
  it("keeps Offer Date / Offer Expiration Date on sales", () => {
    for (const s of ["PURCHASE", "LISTING", "DUAL"]) {
      expect(offerDateLabels(s, "RESIDENTIAL")).toEqual({ date: "Offer Date", expiration: "Offer Expiration Date" });
      expect(offerDateLabels(s, "COMMERCIAL")).toEqual({ date: "Offer Date", expiration: "Offer Expiration Date" });
    }
  });
  it("uses LOI dates on commercial leases", () => {
    for (const s of ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]) {
      expect(offerDateLabels(s, "COMMERCIAL")).toEqual({ date: "LOI Date", expiration: "LOI Expiration Date" });
    }
  });
  it("hides them on residential leases (no offer phase — a rental application)", () => {
    for (const s of ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]) {
      expect(offerDateLabels(s, "RESIDENTIAL")).toBeNull();
    }
  });
});

describe("commissionDisplay", () => {
  it("shows a percentage, a flat amount, or a dash", () => {
    expect(commissionDisplay(2.5, null)).toBe("2.5%");
    expect(commissionDisplay(null, 15000)).toBe("$15,000");
    expect(commissionDisplay(null, null)).toBe("—");
  });
});
