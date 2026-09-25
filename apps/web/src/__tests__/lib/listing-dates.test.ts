import { describe, it, expect } from "vitest";
import { listingDatesError } from "@/lib/listing-dates";

describe("listingDatesError", () => {
  it("returns null for a valid list date and later expiration", () => {
    expect(listingDatesError("2026-09-24", "2027-03-24")).toBeNull();
  });

  it("allows an expiration equal to the list date", () => {
    expect(listingDatesError("2026-09-24", "2026-09-24")).toBeNull();
  });

  it.each([
    ["", "2027-03-24"],
    ["2026-09-24", ""],
    [null, "2027-03-24"],
    ["2026-09-24", null],
  ])("requires both dates (list=%j, expiration=%j)", (list, exp) => {
    expect(listingDatesError(list, exp)).toBe("List date and expiration date are required");
  });

  it("rejects an expiration before the list date", () => {
    expect(listingDatesError("2026-09-24", "2026-09-23")).toBe("Expiration date can't be before the list date");
  });

  it("compares a stored Date against a new 'YYYY-MM-DD' string", () => {
    expect(listingDatesError(new Date("2026-09-24T00:00:00.000Z"), "2026-09-01")).toBe("Expiration date can't be before the list date");
    expect(listingDatesError(new Date("2026-09-24T00:00:00.000Z"), "2026-09-24")).toBeNull();
  });
});
