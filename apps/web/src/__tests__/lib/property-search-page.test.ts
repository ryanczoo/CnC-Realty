import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { property: { findMany: vi.fn(), count: vi.fn() } } }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), setex: vi.fn() } }));

import { searchPageWhere } from "@/lib/property-search-page";
import { buildLocationWhere } from "@/lib/property-search-query";
import { MULTIFAMILY_TYPES, COMMERCIAL_TYPES } from "@/types/property";

const base = { status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] } };

describe("searchPageWhere", () => {
  it("defaults to active for-sale listings", () => {
    expect(searchPageWhere({})).toEqual({ ...base, listingType: "FOR_SALE" });
  });
  it("adds the location filter for a typed place", () => {
    expect(searchPageWhere({ query: " Cerritos " })).toEqual({
      ...base, listingType: "FOR_SALE", ...buildLocationWhere("Cerritos"),
    });
  });
  it("matches the city exactly for a city page, never a city that only contains the name", () => {
    expect(searchPageWhere({ city: " Walnut " })).toEqual({
      ...base, listingType: "FOR_SALE", city: { equals: "Walnut", mode: "insensitive" },
    });
  });
  it("uses the exact city instead of the typed place when both are given", () => {
    const where = searchPageWhere({ city: "Bell", query: "Bell" });
    expect(where.city).toEqual({ equals: "Bell", mode: "insensitive" });
    expect(where.OR).toBeUndefined();
  });
  it("applies price, beds, baths and listing type", () => {
    expect(searchPageWhere({ listingType: "FOR_RENT", minPrice: "1000", maxPrice: "x", minBeds: "3", minBaths: "1.5" })).toEqual({
      ...base, listingType: "FOR_RENT", listPrice: { gte: 1000 }, beds: { gte: 3 }, baths: { gte: 1.5 },
    });
  });
  it("expands the multi-family and commercial groups", () => {
    expect(searchPageWhere({ propertyType: "MultiFamily" }).propertyType).toEqual({ in: [...MULTIFAMILY_TYPES] });
    expect(searchPageWhere({ propertyType: "Commercial" }).propertyType).toEqual({ in: [...COMMERCIAL_TYPES] });
    expect(searchPageWhere({ propertyType: "Condo" }).propertyType).toEqual({ contains: "Condo", mode: "insensitive" });
  });
});
