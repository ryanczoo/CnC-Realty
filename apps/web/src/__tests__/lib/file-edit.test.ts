import { describe, it, expect } from "vitest";
import { transactionEditData, requiredFieldError } from "@/lib/file-edit";

describe("transactionEditData", () => {
  it("parses each editable field type and ignores anything not editable", () => {
    expect(transactionEditData({
      mlsNumber: "1234567890", propertyType: "Condo", legalDescription: "Lot 4",
      salePrice: "900000", deposit: "25000.50", yearBuilt: "1998", numberOfParcels: "2",
      acceptanceDate: "2026-09-20", leaseStartDate: "2026-10-01",
      transactionSide: "DUAL", agentId: "someone-else", status: "CLOSED",
    })).toEqual({
      mlsNumber: "1234567890", propertyType: "Condo", legalDescription: "Lot 4",
      salePrice: 900000, deposit: 25000.5, yearBuilt: 1998, numberOfParcels: 2,
      acceptanceDate: new Date("2026-09-20"), leaseStartDate: new Date("2026-10-01"),
    });
  });

  it("clears optional fields to null when blank", () => {
    expect(transactionEditData({ mlsNumber: "", escrowNumber: "", deposit: "", yearBuilt: "", closeOfEscrow: "" })).toEqual({
      mlsNumber: null, escrowNumber: null, deposit: null, yearBuilt: null, closeOfEscrow: null,
    });
  });

  it("only includes fields that were sent", () => {
    expect(transactionEditData({ salePrice: "5" })).toEqual({ salePrice: 5 });
  });
});

describe("requiredFieldError", () => {
  const sale = { transactionSide: "PURCHASE" };
  const lease = { transactionSide: "LEASE_TENANT" };

  it.each(["propertyAddress", "city", "zip", "propertyType", "salePrice"])("won't clear a sale's %s", (field) => {
    expect(requiredFieldError("transaction", { [field]: "" }, sale)).toMatch(/can't be blank/);
  });

  it("requires the lease amount (not the sale price) on a lease", () => {
    expect(requiredFieldError("transaction", { leasePrice: "" }, lease)).toMatch(/can't be blank/);
    expect(requiredFieldError("transaction", { salePrice: "" }, lease)).toBeNull();
  });

  it("lets optional transaction fields — including MLS # — be cleared", () => {
    expect(requiredFieldError("transaction", { mlsNumber: "", escrowNumber: "", closeOfEscrow: "" }, sale)).toBeNull();
  });

  it("never blocks referral files (they don't use these fields)", () => {
    expect(requiredFieldError("transaction", { propertyAddress: "" }, { transactionSide: "REFERRAL" })).toBeNull();
  });

  it.each(["propertyAddress", "city", "zip", "listPrice"])("won't clear a listing's %s", (field) => {
    expect(requiredFieldError("listing", { [field]: "  " })).toMatch(/can't be blank/);
  });

  it("names the field in the message", () => {
    expect(requiredFieldError("transaction", { salePrice: "" }, sale)).toBe("Sale Price can't be blank");
    expect(requiredFieldError("listing", { propertyAddress: "" })).toBe("Address can't be blank");
  });
});
