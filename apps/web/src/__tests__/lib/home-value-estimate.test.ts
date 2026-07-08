import { describe, it, expect } from "vitest";
import { computeEstimate, percentile } from "@/lib/home-value-estimate";

describe("percentile", () => {
  it("returns the single value for a one-element array", () => {
    expect(percentile([500], 0.5)).toBe(500);
  });

  it("returns the median for an odd-length sorted array", () => {
    expect(percentile([100, 200, 300], 0.5)).toBe(200);
  });

  it("interpolates for an even-length sorted array", () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
  });
});

describe("computeEstimate", () => {
  it("returns null for an empty comps array", () => {
    expect(computeEstimate([], 2000)).toBeNull();
  });

  it("returns null when subjectSqft is null, zero, or negative", () => {
    const comps = [{ closePrice: 500000, sqft: 1000 }];
    expect(computeEstimate(comps, null)).toBeNull();
    expect(computeEstimate(comps, 0)).toBeNull();
    expect(computeEstimate(comps, -100)).toBeNull();
  });

  it("computes a point estimate from the median $/sqft of comps", () => {
    // $/sqft: 500, 600, 700 -> median 600
    const comps = [
      { closePrice: 500000, sqft: 1000 },
      { closePrice: 600000, sqft: 1000 },
      { closePrice: 700000, sqft: 1000 },
    ];
    const result = computeEstimate(comps, 1500);
    expect(result).not.toBeNull();
    expect(result!.pointEstimate).toBe(900000); // 600 * 1500
    expect(result!.compCount).toBe(3);
  });

  it("computes rangeLow/rangeHigh from the 25th/75th percentile $/sqft", () => {
    const comps = [
      { closePrice: 500000, sqft: 1000 }, // 500
      { closePrice: 600000, sqft: 1000 }, // 600
      { closePrice: 700000, sqft: 1000 }, // 700
      { closePrice: 800000, sqft: 1000 }, // 800
    ];
    const result = computeEstimate(comps, 1000);
    expect(result).not.toBeNull();
    // sorted $/sqft: [500,600,700,800] -> p25=575, p75=725
    expect(result!.rangeLow).toBe(575000);
    expect(result!.rangeHigh).toBe(725000);
  });

  it("filters out comps with zero or missing sqft/closePrice before computing", () => {
    const comps = [
      { closePrice: 500000, sqft: 1000 },
      { closePrice: 0, sqft: 1000 },
      { closePrice: 500000, sqft: 0 },
    ];
    const result = computeEstimate(comps, 1000);
    expect(result).not.toBeNull();
    expect(result!.compCount).toBe(1);
  });

  it("returns null when all comps are filtered out as invalid", () => {
    const comps = [{ closePrice: 0, sqft: 1000 }];
    expect(computeEstimate(comps, 1000)).toBeNull();
  });
});
