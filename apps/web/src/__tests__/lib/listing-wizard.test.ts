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
  propertyType: "Single Family",
  yearBuilt: "1990",
};

const empty = { propertyAddress: "", city: "", zip: "", listPrice: "", listingType: "", listDate: "", expirationDate: "", propertyType: "", yearBuilt: "" };

describe("canAdvanceListingStep — Listing Info (step 1)", () => {
  it("blocks when the form is empty", () => {
    expect(canAdvanceListingStep(1, { ...empty, listingType: "RESIDENTIAL_SALE" }, [])).toBe(false);
  });

  it("allows once every required field is filled", () => {
    expect(canAdvanceListingStep(1, complete, [])).toBe(true);
  });

  it.each(["propertyAddress", "city", "zip", "listPrice", "listDate", "expirationDate", "propertyType", "yearBuilt"] as const)(
    "blocks when %s is missing",
    (field) => {
      expect(canAdvanceListingStep(1, { ...complete, [field]: "" }, [])).toBe(false);
    }
  );

  it("treats a whitespace-only address as missing", () => {
    expect(canAdvanceListingStep(1, { ...complete, propertyAddress: "   " }, [])).toBe(false);
  });

  it("blocks when the expiration date is before the list date", () => {
    expect(canAdvanceListingStep(1, { ...complete, listDate: "2026-09-24", expirationDate: "2026-09-23" }, [])).toBe(false);
  });

  it("allows an expiration date equal to the list date", () => {
    expect(canAdvanceListingStep(1, { ...complete, listDate: "2026-09-24", expirationDate: "2026-09-24" }, [])).toBe(true);
  });
});

describe("canAdvanceListingStep — Sellers (step 2)", () => {
  it("blocks when no seller has a name", () => {
    expect(canAdvanceListingStep(2, complete, [seller("")])).toBe(false);
  });

  it("blocks when the only seller name is whitespace", () => {
    expect(canAdvanceListingStep(2, complete, [seller("   ")])).toBe(false);
  });

  it("allows one named seller with no email or phone", () => {
    expect(canAdvanceListingStep(2, complete, [seller("Jane Seller")])).toBe(true);
  });

  it("blocks when a named seller has an invalid email", () => {
    expect(canAdvanceListingStep(2, complete, [seller("Jane Seller", "not-an-email")])).toBe(false);
  });

  it("ignores an invalid email on an unnamed extra row (it is never submitted)", () => {
    expect(canAdvanceListingStep(2, complete, [seller("Jane Seller"), seller("", "junk")])).toBe(true);
  });
});

describe("canAdvanceListingStep — Commission (step 3)", () => {
  it("has no required fields", () => {
    expect(canAdvanceListingStep(3, empty, [])).toBe(true);
  });
});

describe("canAdvanceListingStep: Commission step (step 3)", () => {
  it("stays optional — a blank commission still advances", () => {
    expect(canAdvanceListingStep(3, { ...complete, commission: "" }, [], "pct")).toBe(true);
  });

  it("blocks Next only for a % over 100", () => {
    expect(canAdvanceListingStep(3, { ...complete, commission: "333" }, [], "pct")).toBe(false);
    expect(canAdvanceListingStep(3, { ...complete, commission: "100" }, [], "pct")).toBe(true);
    expect(canAdvanceListingStep(3, { ...complete, commission: "333000" }, [], "flat")).toBe(true);
  });
});

describe("canAdvanceListingStep — Listing Type (step 0)", () => {
  it("needs a listing type picked", () => {
    expect(canAdvanceListingStep(0, empty, [])).toBe(false);
    expect(canAdvanceListingStep(0, { ...empty, listingType: "COMMERCIAL_LEASE" }, [])).toBe(true);
  });
});

describe("canAdvanceListingStep — Year Built on Listing Info", () => {
  it("Land needs no year; any year must be 1500 through next year", () => {
    expect(canAdvanceListingStep(1, { ...complete, propertyType: "Land", yearBuilt: "" }, [])).toBe(true);
    expect(canAdvanceListingStep(1, { ...complete, yearBuilt: "1400" }, [])).toBe(false);
    expect(canAdvanceListingStep(1, { ...complete, yearBuilt: "1500" }, [])).toBe(true);
  });
});

describe("canAdvanceListingStep — Review (step 4)", () => {
  it("always advances", () => {
    expect(canAdvanceListingStep(4, empty, [])).toBe(true);
  });
});
