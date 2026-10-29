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

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NearbyCities } from "@/components/properties/SearchResults";
import { filtersFromParams } from "@/hooks/useSearchFilters";

describe("filtersFromParams", () => {
  it("reads the search filters from the address bar", () => {
    const f = filtersFromParams(new URLSearchParams("query=Cerritos&minBeds=3"));
    expect(f).toEqual({
      query: "Cerritos", listingType: "FOR_SALE", minPrice: "", maxPrice: "", minBeds: "3", minBaths: "", propertyType: "",
    });
  });
});

describe("NearbyCities", () => {
  it("links each nearby city page", () => {
    const html = renderToStaticMarkup(createElement(NearbyCities, { cities: [{ name: "Artesia", href: "/homes-for-sale/artesia" }] }));
    expect(html).toContain("Nearby");
    expect(html).toContain('href="/homes-for-sale/artesia"');
    expect(html).toContain(">Artesia<");
  });
  it("renders nothing without cities", () => {
    expect(renderToStaticMarkup(createElement(NearbyCities, { cities: [] }))).toBe("");
  });
});
