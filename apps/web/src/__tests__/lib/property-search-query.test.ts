import { describe, it, expect } from "vitest";
import { buildLocationWhere } from "@/lib/property-search-query";

describe("buildLocationWhere", () => {
  it("matches on zip for an exact 5-digit query", () => {
    expect(buildLocationWhere("90210")).toEqual({ zip: "90210" });
  });

  it("matches on address only for a query starting with a house number", () => {
    expect(buildLocationWhere("12802 Cantrece Street")).toEqual({
      address: { contains: "12802 Cantrece Street", mode: "insensitive" },
    });
  });

  it("matches on city only for a query starting with a letter", () => {
    expect(buildLocationWhere("Anaheim")).toEqual({
      city: { contains: "Anaheim", mode: "insensitive" },
    });
  });

  it("does not treat a 4-digit number as a zip — treats it as an address search", () => {
    expect(buildLocationWhere("1234")).toEqual({
      address: { contains: "1234", mode: "insensitive" },
    });
  });

  it("does not treat a 6-digit number as a zip — treats it as an address search", () => {
    expect(buildLocationWhere("123456")).toEqual({
      address: { contains: "123456", mode: "insensitive" },
    });
  });

  it("treats a city name that happens to also be a common street name as city-only (the bug this fixes)", () => {
    expect(buildLocationWhere("Cerritos")).toEqual({
      city: { contains: "Cerritos", mode: "insensitive" },
    });
  });

  // People type locations the way Zillow and Google take them. Each of these
  // returned 0 homes on the live site (2026-10-15) because the whole string
  // was matched against the city name.
  describe("city typed with a state", () => {
    const city = (c: string) => ({ city: { contains: c, mode: "insensitive" } });

    it.each([
      ["monterey park, california", "monterey park"],
      ["monterey park, ca", "monterey park"],
      ["Los Angeles, CA", "Los Angeles"],
      ["Los Angeles CA", "Los Angeles"],
      ["Los Angeles, Calif.", "Los Angeles"],
      ["Pasadena, CA, USA", "Pasadena"],
      ["Pasadena, California, United States", "Pasadena"],
      ["  Monterey   Park ,  CA  ", "Monterey Park"],
    ])("%s → city %s", (q, c) => {
      expect(buildLocationWhere(q)).toEqual(city(c));
    });

    it("keeps a city whose name merely ends in the letters ca", () => {
      expect(buildLocationWhere("Fonseca")).toEqual(city("Fonseca"));
    });
  });

  describe("zip code inside a longer location", () => {
    it.each([
      ["Monterey Park CA 91754", "91754"],
      ["Monterey Park, CA 91754", "91754"],
      ["91754, CA", "91754"],
      ["Monterey Park 91754-1234", "91754"],
    ])("%s → zip %s", (q, z) => {
      expect(buildLocationWhere(q)).toEqual({ zip: z });
    });
  });

  describe("street address with city and state", () => {
    const address = (a: string) => ({ address: { contains: a, mode: "insensitive" } });

    it.each([
      ["123 Main St, Monterey Park, CA", "123 Main St"],
      ["123 Main St, Monterey Park, CA 91754", "123 Main St"],
      ["12802 Cantrece Street, Cerritos", "12802 Cantrece Street"],
    ])("%s → address %s", (q, a) => {
      expect(buildLocationWhere(q)).toEqual(address(a));
    });

    it("does not mistake a 5-digit house number for a zip", () => {
      expect(buildLocationWhere("12802 Cantrece Street")).toEqual(address("12802 Cantrece Street"));
    });
  });

  it("falls back to the raw text when only a state was typed", () => {
    expect(buildLocationWhere("California")).toEqual({
      city: { contains: "California", mode: "insensitive" },
    });
  });
});
