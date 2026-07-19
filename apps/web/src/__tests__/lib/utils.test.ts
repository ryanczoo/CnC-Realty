import { describe, it, expect } from "vitest";
import { formatCompactCurrency } from "@/lib/utils";

describe("formatCompactCurrency", () => {
  it("strips a trailing .0 for whole millions", () => {
    expect(formatCompactCurrency(1_000_000)).toBe("$1M");
  });

  it("shows 1 decimal place for non-whole millions", () => {
    expect(formatCompactCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCompactCurrency(1_234_567)).toBe("$1.2M");
  });

  it("formats thousands with a lowercase-free K suffix and no decimals", () => {
    expect(formatCompactCurrency(725_000)).toBe("$725K");
  });

  it("formats sub-thousand values with a plain dollar sign", () => {
    expect(formatCompactCurrency(500)).toBe("$500");
  });

  it("returns an em dash for null", () => {
    expect(formatCompactCurrency(null)).toBe("—");
  });
});
