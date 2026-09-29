import { describe, it, expect } from "vitest";
import { getPageNums, parsePage } from "./pagination";

describe("getPageNums", () => {
  it("lists every page when there are 7 or fewer", () => {
    expect(getPageNums(1, 3)).toEqual([1, 2, 3]);
    expect(getPageNums(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns nothing for zero pages", () => {
    expect(getPageNums(1, 0)).toEqual([]);
  });

  it("collapses the far end near the start", () => {
    expect(getPageNums(1, 10)).toEqual([1, 2, "...", 10]);
  });

  it("collapses both sides in the middle", () => {
    expect(getPageNums(5, 10)).toEqual([1, "...", 4, 5, 6, "...", 10]);
  });

  it("collapses the near end at the last page", () => {
    expect(getPageNums(10, 10)).toEqual([1, "...", 9, 10]);
  });
});

describe("parsePage", () => {
  it("reads a positive whole number", () => {
    expect(parsePage("3")).toBe(3);
  });

  it("falls back to page 1 for missing, junk, zero or negative values", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
  });

  it("uses the first value when the param repeats", () => {
    expect(parsePage(["4", "9"])).toBe(4);
  });
});
