import { describe, it, expect } from "vitest";
import { transactionDatesError } from "@/lib/transaction-dates";

describe("transactionDatesError (the one transaction date-order rule)", () => {
  it("allows dates in order, same-day pairs, and missing dates", () => {
    expect(transactionDatesError({ acceptanceDate: "2026-09-20", closeOfEscrow: "2026-10-20" })).toBeNull();
    expect(transactionDatesError({ acceptanceDate: "2026-09-20", closeOfEscrow: "2026-09-20" })).toBeNull();
    expect(transactionDatesError({ acceptanceDate: "2026-09-20", closeOfEscrow: "" })).toBeNull();
    expect(transactionDatesError({})).toBeNull();
  });

  it("refuses Close of Escrow before the Acceptance Date", () => {
    expect(transactionDatesError({ acceptanceDate: "2026-09-20", closeOfEscrow: "2026-09-19" }))
      .toBe("Close of Escrow can't be before the Acceptance Date");
  });

  it("refuses an offer that expires before it's made (LOI wording on a commercial lease)", () => {
    expect(transactionDatesError({ offerDate: "2026-09-20", offerExpirationDate: "2026-09-18" }))
      .toBe("Offer Expiration Date can't be before the Offer Date");
    expect(transactionDatesError({ offerDate: "2026-09-20", offerExpirationDate: "2026-09-18" }, {}, { side: "LEASE_TENANT", propertyCategory: "COMMERCIAL" }))
      .toBe("LOI Expiration Date can't be before the LOI Date");
  });

  it("refuses a lease that starts before it's signed", () => {
    expect(transactionDatesError({ leaseSignedDate: "2026-10-02", leaseStartDate: "2026-10-01" }))
      .toBe("Lease Start Date can't be before the Lease Signed Date");
  });

  it("checks an edited date against the saved one (Overview pencils)", () => {
    const saved = { acceptanceDate: new Date("2026-09-20"), closeOfEscrow: new Date("2026-10-20") };
    expect(transactionDatesError({ closeOfEscrow: "2026-09-01" }, saved)).toBe("Close of Escrow can't be before the Acceptance Date");
    expect(transactionDatesError({ acceptanceDate: "2026-11-01" }, saved)).toBe("Close of Escrow can't be before the Acceptance Date");
    expect(transactionDatesError({ closeOfEscrow: "2026-11-01" }, saved)).toBeNull();
    expect(transactionDatesError({ closeOfEscrow: "" }, saved)).toBeNull();
  });

  it("only re-checks the pairs an edit touches (older data never blocks unrelated edits)", () => {
    const saved = { acceptanceDate: new Date("2026-09-20"), closeOfEscrow: new Date("2026-09-01") };
    expect(transactionDatesError({ offerDate: "2026-09-01" }, saved)).toBeNull();
    expect(transactionDatesError({ acceptanceDate: "2026-09-19" }, saved)).toBe("Close of Escrow can't be before the Acceptance Date");
  });
});
