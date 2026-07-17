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
