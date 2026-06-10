import { describe, it, expect } from "vitest";
import { getSlideState } from "@/components/rent/RentCitiesSlider";

describe("getSlideState", () => {
  it("marks the active index as active", () => {
    expect(getSlideState(2, 2, 5)).toBe("active");
  });

  it("marks the immediately previous index as prev", () => {
    expect(getSlideState(1, 2, 5)).toBe("prev");
  });

  it("marks the immediately next index as next", () => {
    expect(getSlideState(3, 2, 5)).toBe("next");
  });

  it("marks all other indices as hidden", () => {
    expect(getSlideState(0, 2, 5)).toBe("hidden");
    expect(getSlideState(4, 2, 5)).toBe("hidden");
  });

  it("wraps around: prev of index 0 is the last index", () => {
    expect(getSlideState(4, 0, 5)).toBe("prev");
  });

  it("wraps around: next of last index is index 0", () => {
    expect(getSlideState(0, 4, 5)).toBe("next");
  });
});
