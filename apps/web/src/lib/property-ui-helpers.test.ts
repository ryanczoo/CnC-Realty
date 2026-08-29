import { describe, it, expect } from "vitest";
import { formatFeatureValue } from "./property-ui-helpers";

describe("formatFeatureValue", () => {
  it("splits PascalCase tokens and spaces them out after commas", () => {
    expect(formatFeatureValue("BreakfastBar,CeilingFans,EatInKitchen")).toBe(
      "Breakfast Bar, Ceiling Fans, Eat In Kitchen"
    );
  });

  it("splits a single PascalCase token with no comma", () => {
    expect(formatFeatureValue("NoCommonWalls")).toBe("No Common Walls");
  });

  it("keeps acronyms intact (no lowercase before the uppercase run)", () => {
    expect(formatFeatureValue("Cash,CashToNewLoan,FHA")).toBe("Cash, Cash To New Loan, FHA");
  });

  it("leaves already-prose text with existing spacing untouched", () => {
    expect(formatFeatureValue("E. of Norwalk Blvd, N. of Mines, and W. of Broadway")).toBe(
      "E. of Norwalk Blvd, N. of Mines, and W. of Broadway"
    );
  });

  it("passes numbers through as plain strings", () => {
    expect(formatFeatureValue(2)).toBe("2");
  });

  it("returns N/A for null, empty string, and false", () => {
    expect(formatFeatureValue(null)).toBe("N/A");
    expect(formatFeatureValue("")).toBe("N/A");
    expect(formatFeatureValue(false)).toBe("N/A");
  });
});
