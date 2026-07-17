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
});
