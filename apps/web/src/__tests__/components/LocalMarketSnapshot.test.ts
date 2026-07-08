import { describe, it, expect } from "vitest";
import { computeBarHeights } from "@/components/home-value/LocalMarketSnapshot";

describe("computeBarHeights", () => {
  it("scales the tallest bar to 100", () => {
    const heights = computeBarHeights([{ count: 4 }, { count: 8 }, { count: 2 }]);
    expect(heights[1]).toBe(100);
  });

  it("scales other bars proportionally to the max", () => {
    const heights = computeBarHeights([{ count: 4 }, { count: 8 }]);
    expect(heights[0]).toBe(50);
  });

  it("returns all zeros when every quarter has zero sales, without dividing by zero", () => {
    const heights = computeBarHeights([{ count: 0 }, { count: 0 }]);
    expect(heights).toEqual([0, 0]);
  });

  it("handles a single quarter", () => {
    expect(computeBarHeights([{ count: 5 }])).toEqual([100]);
  });
});
