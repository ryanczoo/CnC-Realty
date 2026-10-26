import { describe, it, expect } from "vitest";
import { yearBuiltError, builtBeforeError, missingPropertyFacts, needsYearBuilt, maxYearBuilt, YEAR_BUILT_MIN } from "@/lib/year-built";

const NOW = new Date("2026-10-25T12:00:00Z");
const RANGE = "Year Built must be between 1500 and 2027";

describe("yearBuiltError", () => {
  it("requires a year unless the property is Land", () => {
    expect(yearBuiltError("", "Single Family", NOW)).toBe("Year Built is required");
    expect(yearBuiltError(null, "Condo", NOW)).toBe("Year Built is required");
    expect(yearBuiltError("", "Land", NOW)).toBeNull();
    expect(yearBuiltError(undefined, "Land", NOW)).toBeNull();
  });
  it("accepts 1500 through next year", () => {
    for (const v of ["1500", "2027", 1952, "1952"]) expect(yearBuiltError(v, "Condo", NOW)).toBeNull();
  });
  it("refuses years outside the range or not four digits", () => {
    for (const v of ["1499", "2028", "0000", "3000", "999", "20", "19a2", 1400]) {
      expect(yearBuiltError(v, "Condo", NOW)).toBe(RANGE);
    }
  });
  it("checks the range on Land too when a year is given", () => {
    expect(yearBuiltError("1400", "Land", NOW)).toBe(RANGE);
  });
});

describe("builtBeforeError", () => {
  it("allows blank (applies to every file) and the same range", () => {
    expect(builtBeforeError("", NOW)).toBeNull();
    expect(builtBeforeError(null, NOW)).toBeNull();
    expect(builtBeforeError(1978, NOW)).toBeNull();
    expect(builtBeforeError("1400", NOW)).toBe("Built before must be between 1500 and 2027");
  });
});

describe("missingPropertyFacts / needsYearBuilt", () => {
  it("names what a file still needs", () => {
    expect(missingPropertyFacts({ propertyType: null, yearBuilt: null })).toEqual(["property type", "year built"]);
    expect(missingPropertyFacts({ propertyType: "Land", yearBuilt: null })).toEqual([]);
    expect(missingPropertyFacts({ propertyType: "Condo", yearBuilt: null })).toEqual(["year built"]);
    expect(missingPropertyFacts({ propertyType: "Condo", yearBuilt: 1990 })).toEqual([]);
    expect(missingPropertyFacts({ propertyType: "", yearBuilt: 1990 })).toEqual(["property type"]);
  });
  it("only Land skips the year", () => {
    expect(needsYearBuilt("Land")).toBe(false);
    expect(needsYearBuilt("Single Family")).toBe(true);
    expect(needsYearBuilt(null)).toBe(true);
  });
  it("max is next calendar year, min 1500", () => {
    expect(maxYearBuilt(NOW)).toBe(2027);
    expect(YEAR_BUILT_MIN).toBe(1500);
  });
});
