import { describe, it, expect } from "vitest";
import { shouldRenderMap } from "@/components/properties/SearchResults";

describe("shouldRenderMap", () => {
  it("renders nothing until mounted (placeholder shows instead)", () => {
    expect(shouldRenderMap(false, false, false)).toBe(false);
    expect(shouldRenderMap(false, true, true)).toBe(false);
  });
  it("desktop always renders the map once mounted (unchanged)", () => {
    expect(shouldRenderMap(true, false, false)).toBe(true);
  });
  it("phones load the map only after the first Show Map tap", () => {
    expect(shouldRenderMap(true, true, false)).toBe(false);
    expect(shouldRenderMap(true, true, true)).toBe(true);
  });
});
