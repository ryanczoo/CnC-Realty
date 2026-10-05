import { describe, it, expect } from "vitest";
import { shouldRenderMap } from "@/components/properties/SearchResults";

describe("shouldRenderMap", () => {
  it("desktop renders the map from the very first render (unchanged timing)", () => {
    expect(shouldRenderMap(false, false, false)).toBe(true);
    expect(shouldRenderMap(false, true, false)).toBe(true);
  });
  it("a phone at load skips the map until the first Show Map tap", () => {
    expect(shouldRenderMap(true, false, false)).toBe(false); // hydration render: live check not yet known
    expect(shouldRenderMap(true, true, false)).toBe(false);
    expect(shouldRenderMap(true, true, true)).toBe(true);
  });
  it("a narrow window widened to desktop width gets the map", () => {
    expect(shouldRenderMap(true, false, false, true)).toBe(true);
  });
});
