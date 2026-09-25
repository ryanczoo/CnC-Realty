import { describe, it, expect } from "vitest";
import { listingTypeLabel, transactionSideLabel, isLeaseSide } from "@/types/transaction";

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
