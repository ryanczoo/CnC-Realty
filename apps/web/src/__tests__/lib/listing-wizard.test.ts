import { describe, it, expect } from "vitest";
import { canAdvanceListingStep } from "@/lib/listing-wizard";

const seller = (name: string, email = "") => ({ name, email, phone: "", company: "", licenseNumber: "" });

const complete = {
  propertyAddress: "123 Main St",
  city: "Irvine",
  zip: "92618",
  listPrice: "1250000",
  listingType: "RESIDENTIAL_SALE",
  listDate: "2026-09-24",
  expirationDate: "2027-03-24",
};

const empty = { propertyAddress: "", city: "", zip: "", listPrice: "", listingType: "", listDate: "", expirationDate: "" };

describe("canAdvanceListingStep — Property Info (step 0)", () => {
  it("blocks when the form is empty", () => {
    expect(canAdvanceListingStep(0, { ...empty, listingType: "RESIDENTIAL_SALE" }, [])).toBe(false);
  });

  it("allows once every required field is filled", () => {
    expect(canAdvanceListingStep(0, complete, [])).toBe(true);
  });

  it.each(["propertyAddress", "city", "zip", "listPrice", "listingType", "listDate", "expirationDate"] as const)(
    "blocks when %s is missing",
    (field) => {
      expect(canAdvanceListingStep(0, { ...complete, [field]: "" }, [])).toBe(false);
    }
  );

  it("treats a whitespace-only address as missing", () => {
    expect(canAdvanceListingStep(0, { ...complete, propertyAddress: "   " }, [])).toBe(false);
  });

  it("blocks when the expiration date is before the list date", () => {
    expect(canAdvanceListingStep(0, { ...complete, listDate: "2026-09-24", expirationDate: "2026-09-23" }, [])).toBe(false);
  });

  it("allows an expiration date equal to the list date", () => {
    expect(canAdvanceListingStep(0, { ...complete, listDate: "2026-09-24", expirationDate: "2026-09-24" }, [])).toBe(true);
  });
});

describe("canAdvanceListingStep — Sellers (step 1)", () => {
  it("blocks when no seller has a name", () => {
    expect(canAdvanceListingStep(1, complete, [seller("")])).toBe(false);
  });

  it("blocks when the only seller name is whitespace", () => {
    expect(canAdvanceListingStep(1, complete, [seller("   ")])).toBe(false);
  });

  it("allows one named seller with no email or phone", () => {
    expect(canAdvanceListingStep(1, complete, [seller("Jane Seller")])).toBe(true);
  });

  it("blocks when a named seller has an invalid email", () => {
    expect(canAdvanceListingStep(1, complete, [seller("Jane Seller", "not-an-email")])).toBe(false);
  });

  it("ignores an invalid email on an unnamed extra row (it is never submitted)", () => {
    expect(canAdvanceListingStep(1, complete, [seller("Jane Seller"), seller("", "junk")])).toBe(true);
  });
});

describe("canAdvanceListingStep — Commission (step 2)", () => {
  it("has no required fields", () => {
    expect(canAdvanceListingStep(2, empty, [])).toBe(true);
  });
});

describe("canAdvanceListingStep: Commission step (step 2)", () => {
  it("stays optional — a blank commission still advances", () => {
    expect(canAdvanceListingStep(2, { ...complete, commission: "" }, [], "pct")).toBe(true);
  });

  it("blocks Next only for a % over 100", () => {
    expect(canAdvanceListingStep(2, { ...complete, commission: "333" }, [], "pct")).toBe(false);
    expect(canAdvanceListingStep(2, { ...complete, commission: "100" }, [], "pct")).toBe(true);
    expect(canAdvanceListingStep(2, { ...complete, commission: "333000" }, [], "flat")).toBe(true);
  });
});
