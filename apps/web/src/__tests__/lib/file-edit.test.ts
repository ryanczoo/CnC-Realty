import { describe, it, expect } from "vitest";
import { transactionEditData, requiredFieldError, commissionPercentError, transactionCommissionEdit, commissionLockedError, commissionChanges } from "@/lib/file-edit";

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

describe("requiredFieldError uses lease wording", () => {
  it("calls a lease listing's price Monthly Rent", () => {
    expect(requiredFieldError("listing", { listPrice: "" }, { listingType: "RESIDENTIAL_LEASE" })).toBe("Monthly Rent can't be blank");
    expect(requiredFieldError("listing", { listPrice: "" }, { listingType: "RESIDENTIAL_SALE" })).toBe("List Price can't be blank");
  });
});

describe("commissionPercentError", () => {
  it.each(["commissionPercent", "saleCommissionPct", "listingCommissionPct"])("rejects %s over 100", (field) => {
    expect(commissionPercentError({ [field]: "15000" })).toBe("Commission can't be more than 100%");
    expect(commissionPercentError({ [field]: 100.5 })).toBe("Commission can't be more than 100%");
  });

  it("allows 100 or less, and blanks", () => {
    expect(commissionPercentError({ saleCommissionPct: "100", listingCommissionPct: 2.5, commissionPercent: "" })).toBeNull();
    expect(commissionPercentError({})).toBeNull();
  });
});

describe("transactionCommissionEdit", () => {
  const tx = {
    transactionSide: "PURCHASE", salePrice: 500000, leasePrice: null,
    saleCommissionPct: 2, saleCommissionAmount: 10000, listingCommissionPct: null, listingCommissionAmount: null,
  };

  it("changes nothing when neither commission nor price is in the edit", () => {
    expect(transactionCommissionEdit({ city: "Irvine" }, tx)).toEqual({});
  });

  it("saves a new % and recomputes the $ amount and GCI", () => {
    expect(transactionCommissionEdit({ saleCommissionPct: "3", saleCommissionAmount: "" }, tx)).toEqual({
      saleCommissionPct: 3, saleCommissionAmount: 15000, listingCommissionPct: null, listingCommissionAmount: null, commissionGCI: 15000,
    });
  });

  it("switching to $ clears the % and keeps the amount", () => {
    expect(transactionCommissionEdit({ saleCommissionPct: "", saleCommissionAmount: "12000" }, tx))
      .toMatchObject({ saleCommissionPct: null, saleCommissionAmount: 12000, commissionGCI: 12000 });
  });

  it("re-prices a % commission when the sale price changes", () => {
    expect(transactionCommissionEdit({ salePrice: "600000" }, tx)).toMatchObject({ saleCommissionAmount: 12000, commissionGCI: 12000 });
  });
});

describe("requiredFieldError keeps commission once past Pre-Contract", () => {
  const pending = { transactionSide: "PURCHASE", status: "PENDING", saleCommissionPct: 2.5 };

  it("won't clear the side's commission", () => {
    expect(requiredFieldError("transaction", { saleCommissionPct: "", saleCommissionAmount: "" }, pending))
      .toBe("Selling Agent Commission can't be blank");
    expect(requiredFieldError("transaction", { listingCommissionPct: "", listingCommissionAmount: "" }, { transactionSide: "LISTING", status: "INCOMPLETE" }))
      .toBe("Listing Agent Commission can't be blank");
    expect(requiredFieldError("transaction", { saleCommissionAmount: "" }, { transactionSide: "LEASE_TENANT", status: "PENDING" }))
      .toBe("Lease Commission can't be blank");
  });

  it("allows switching % to $ (one of the two stays filled)", () => {
    expect(requiredFieldError("transaction", { saleCommissionPct: "", saleCommissionAmount: "5000" }, pending)).toBeNull();
  });

  it("lets a Pre-Contract file leave commission empty", () => {
    expect(requiredFieldError("transaction", { saleCommissionPct: "", saleCommissionAmount: "" }, { ...pending, status: "PRE_CONTRACT" })).toBeNull();
  });

  it("doesn't touch edits that don't include commission", () => {
    expect(requiredFieldError("transaction", { city: "Irvine" }, { transactionSide: "PURCHASE", status: "PENDING" })).toBeNull();
  });
});

describe("commissionLockedError", () => {
  const MSG = "Commission is locked while this file is in broker review";

  it("refuses an agent's commission edit while Awaiting Review (listing and transaction)", () => {
    expect(commissionLockedError("listing", { commissionPercent: "3" }, { awaitingReview: true }, "AGENT")).toBe(MSG);
    expect(commissionLockedError("transaction", { saleCommissionAmount: "9000" }, { awaitingReview: true }, "AGENT")).toBe(MSG);
  });

  it("allows the broker, other fields, and files not in review", () => {
    expect(commissionLockedError("listing", { commissionPercent: "3" }, { awaitingReview: true }, "ADMIN")).toBeNull();
    expect(commissionLockedError("transaction", { city: "Irvine" }, { awaitingReview: true }, "AGENT")).toBeNull();
    expect(commissionLockedError("transaction", { saleCommissionPct: "3" }, { awaitingReview: false }, "AGENT")).toBeNull();
  });
});

describe("commissionChanges", () => {
  it("reports a listing's commission change in display form", () => {
    expect(commissionChanges("listing", { commissionPercent: 2.5, commissionAmount: null }, { commissionPercent: null, commissionAmount: 15000 }))
      .toEqual([{ label: "Commission", from: "2.5%", to: "$15,000" }]);
  });

  it("names each transaction side, and only lists sides that changed", () => {
    const before = { transactionSide: "DUAL", saleCommissionPct: 2, saleCommissionAmount: 20000, listingCommissionPct: 2.5, listingCommissionAmount: 25000 };
    expect(commissionChanges("transaction", before, { ...before, saleCommissionPct: 3, saleCommissionAmount: 30000 }))
      .toEqual([{ label: "Selling Agent Commission", from: "2%", to: "3%" }]);
    expect(commissionChanges("transaction", before, { ...before, listingCommissionPct: null, listingCommissionAmount: 12000 }))
      .toEqual([{ label: "Listing Agent Commission", from: "2.5%", to: "$12,000" }]);
  });

  it("calls a lease's commission Lease Commission (always $)", () => {
    expect(commissionChanges("transaction",
      { transactionSide: "LEASE_TENANT", saleCommissionPct: null, saleCommissionAmount: null },
      { transactionSide: "LEASE_TENANT", saleCommissionPct: null, saleCommissionAmount: 3000 }))
      .toEqual([{ label: "Lease Commission", from: "—", to: "$3,000" }]);
  });

  it("is empty when nothing about commission changed", () => {
    const f = { transactionSide: "PURCHASE", saleCommissionPct: 2.5, saleCommissionAmount: 12500 };
    expect(commissionChanges("transaction", f, { ...f })).toEqual([]);
  });
});
