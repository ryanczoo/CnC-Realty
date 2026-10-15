import { describe, it, expect } from "vitest";
import { buildFilterQueryString } from "@/lib/search-filters";
import { DEFAULT_FILTERS } from "@/types/property";

describe("buildFilterQueryString", () => {
  it("omits keys with empty-string values, but keeps listingType's non-empty default", () => {
    expect(buildFilterQueryString(DEFAULT_FILTERS)).toBe("listingType=FOR_SALE");
  });

  it("includes a set query alongside the default listingType", () => {
    const qs = buildFilterQueryString({ ...DEFAULT_FILTERS, query: "Cerritos" });
    expect(qs).toBe("query=Cerritos&listingType=FOR_SALE");
  });

  it("includes multiple set filters", () => {
    const qs = buildFilterQueryString({
      ...DEFAULT_FILTERS,
      query: "Cerritos",
      minPrice: "500000",
      minBeds: "3",
    });
    expect(qs).toBe("query=Cerritos&listingType=FOR_SALE&minPrice=500000&minBeds=3");
  });

  it("URL-encodes special characters in values", () => {
    const qs = buildFilterQueryString({ ...DEFAULT_FILTERS, query: "Los Angeles" });
    expect(qs).toBe("query=Los+Angeles&listingType=FOR_SALE");
  });

  it("omits every key when all values are empty strings", () => {
    const qs = buildFilterQueryString({
      query: "",
      listingType: "",
      minPrice: "",
      maxPrice: "",
      minBeds: "",
      minBaths: "",
      propertyType: "",
    });
    expect(qs).toBe("");
  });
});

import { parsedToFilterPatch } from "@/lib/search-filters";
import { buildPropertySearchParams } from "@/lib/property-search";

describe("parsedToFilterPatch", () => {
  const patch = (s: string) => parsedToFilterPatch(buildPropertySearchParams(s));
  it("carries every typed filter", () => {
    expect(patch("condos in Pasadena under 800k")).toEqual({ query: "Pasadena", propertyType: "Condominium", minPrice: "", maxPrice: "800000" });
    expect(patch("Pasadena homes for rent")).toEqual({ query: "Pasadena", listingType: "FOR_RENT" });
  });
  it("a plain location leaves the other filters as they are (Zillow keeps them)", () => {
    expect(patch("Pasadena")).toEqual({ query: "Pasadena" });
  });
  it("a typed price replaces both ends", () => {
    expect(patch("over 1m")).toEqual({ query: "", minPrice: "1000000", maxPrice: "" });
  });
});
