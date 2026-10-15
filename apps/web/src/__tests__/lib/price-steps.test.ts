import { describe, it, expect } from "vitest";
import { PRICE_STEPS, LAST_STEP, minIndexFor, maxIndexFor, minValueAt, maxValueAt, stepLabel, normalizePriceDraft } from "@/lib/price-steps";

describe("price steps", () => {
  it("$25K to $1M, $100K to $2M, $250K to $5M, $1M to $10M", () => {
    expect(PRICE_STEPS).toHaveLength(68);
    expect(LAST_STEP).toBe(67);
    expect(PRICE_STEPS.slice(0, 3)).toEqual([0, 25_000, 50_000]);
    expect(PRICE_STEPS[40]).toBe(1_000_000);
    expect(PRICE_STEPS[41]).toBe(1_100_000);
    expect(PRICE_STEPS[51]).toBe(2_250_000);
    expect(PRICE_STEPS[63]).toBe(6_000_000);
    expect(PRICE_STEPS[67]).toBe(10_000_000);
  });
  it("labels", () => {
    expect([0, 1, 40, 41, 51, 67].map(stepLabel)).toEqual(["$0", "$25K", "$1M", "$1.1M", "$2.25M", "$10M+"]);
  });
  it("ends mean 'no limit'", () => {
    expect(minValueAt(0)).toBe("");
    expect(maxValueAt(LAST_STEP)).toBe("");
    expect(minIndexFor("")).toBe(0);
    expect(maxIndexFor("")).toBe(LAST_STEP);
  });
  it("a typed amount puts the handle on the nearest step inside the range", () => {
    expect(minIndexFor("812500")).toBe(32); // $800K
    expect(maxIndexFor("812500")).toBe(33); // $825K
    expect(maxIndexFor("20000000")).toBe(LAST_STEP);
    expect(minValueAt(32)).toBe("800000");
  });
  it("a typed min above max is swapped, not left to return nothing", () => {
    expect(normalizePriceDraft("900000", "500000")).toEqual({ minPrice: "500000", maxPrice: "900000" });
    expect(normalizePriceDraft("500000", "")).toEqual({ minPrice: "500000", maxPrice: "" });
  });
});
