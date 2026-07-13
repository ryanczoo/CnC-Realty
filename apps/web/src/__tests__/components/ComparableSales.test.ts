import { describe, it, expect } from "vitest";
import { paginate } from "@/components/home-value/ComparableSales";

describe("paginate", () => {
  it("returns the first page slice", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(paginate(items, 0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("returns the remainder on the last page", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(paginate(items, 1, 9)).toEqual([10]);
  });

  it("returns an empty array for a page past the end", () => {
    const items = [1, 2, 3];
    expect(paginate(items, 5, 9)).toEqual([]);
  });

  it("returns everything on page 0 when there are fewer items than the page size", () => {
    const items = [1, 2, 3];
    expect(paginate(items, 0, 9)).toEqual([1, 2, 3]);
  });
});
