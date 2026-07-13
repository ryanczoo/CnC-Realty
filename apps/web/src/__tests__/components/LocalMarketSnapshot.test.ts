import { describe, it, expect } from "vitest";
import { computeBarHeights } from "@/components/home-value/LocalMarketSnapshot";

describe("computeBarHeights", () => {
  it("scales the tallest bar to 100", () => {
    const heights = computeBarHeights([{ value: 4 }, { value: 8 }, { value: 2 }]);
    expect(heights[1]).toBe(100);
  });

  it("scales other bars proportionally to the max", () => {
    const heights = computeBarHeights([{ value: 4 }, { value: 8 }]);
    expect(heights[0]).toBe(50);
  });

  it("returns all zeros when every bar has zero value, without dividing by zero", () => {
    const heights = computeBarHeights([{ value: 0 }, { value: 0 }]);
    expect(heights).toEqual([0, 0]);
  });

  it("handles a single bar", () => {
    expect(computeBarHeights([{ value: 5 }])).toEqual([100]);
  });
});
