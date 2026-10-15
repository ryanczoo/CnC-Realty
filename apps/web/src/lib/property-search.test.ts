import { describe, it, expect } from "vitest";
import { buildPropertySearchParams } from "./property-search";

describe("buildPropertySearchParams", () => {
  it("extracts bed count from 'N bed' phrasing", () => {
    const params = buildPropertySearchParams("3 bed homes in Pasadena");
    expect(params.get("minBeds")).toBe("3");
  });

  it("extracts bed count from 'N-bed' phrasing", () => {
    const params = buildPropertySearchParams("4-bed house");
    expect(params.get("minBeds")).toBe("4");
  });

  it("extracts city from a trailing 'in {city}' clause", () => {
    const params = buildPropertySearchParams("3 bed homes in Pasadena");
    expect(params.get("query")).toBe("Pasadena");
  });

  it("extracts the 'in {city}' clause when a state follows the city", () => {
    expect(buildPropertySearchParams("3 bed homes in Pasadena, CA").get("query")).toBe("Pasadena, CA");
    expect(buildPropertySearchParams("homes in Monterey Park, California").get("query")).toBe("Monterey Park, California");
  });

  it("falls back to the raw query when there's no 'in {city}' clause", () => {
    const params = buildPropertySearchParams("90210");
    expect(params.get("query")).toBe("90210");
    expect(params.get("minBeds")).toBeNull();
  });

  it("falls back to the raw query for a plain city name with no bed count", () => {
    const params = buildPropertySearchParams("Los Angeles, CA");
    expect(params.get("query")).toBe("Los Angeles, CA");
  });

  it("strips the bed-count fragment from the query when there's no 'in {city}' clause", () => {
    const params = buildPropertySearchParams("3 bed whittier");
    expect(params.get("minBeds")).toBe("3");
    expect(params.get("query")).toBe("whittier");
  });

  const p = (s: string) => Object.fromEntries(buildPropertySearchParams(s).entries());

  it("drops filler words around the city", () => {
    expect(p("Pasadena homes for sale")).toEqual({ query: "Pasadena", listingType: "FOR_SALE" });
    expect(p("homes for sale near Pasadena")).toEqual({ query: "Pasadena", listingType: "FOR_SALE" });
    expect(p("3 bed home in Whittier")).toEqual({ query: "Whittier", minBeds: "3" });
  });
  it("for rent switches the listing type", () => {
    expect(p("Pasadena homes for rent")).toEqual({ query: "Pasadena", listingType: "FOR_RENT" });
  });
  it("property type words", () => {
    expect(p("condos in Pasadena under 800k")).toEqual({ query: "Pasadena", propertyType: "Condominium", maxPrice: "800000" });
    expect(p("townhomes in pasadena")).toEqual({ query: "pasadena", propertyType: "Townhouse" });
  });
  it("prices", () => {
    expect(p("Pasadena under 1M")).toEqual({ query: "Pasadena", maxPrice: "1000000" });
    expect(p("over 1m")).toEqual({ minPrice: "1000000" });
    expect(p("between 500k and 800k")).toEqual({ minPrice: "500000", maxPrice: "800000" });
    expect(p("between 500 and 800k")).toEqual({ minPrice: "500000", maxPrice: "800000" });
    expect(p("homes under $1.5M in Glendale")).toEqual({ query: "Glendale", maxPrice: "1500000" });
    expect(p("under 750,000")).toEqual({ maxPrice: "750000" });
  });
  it("beds and baths shorthand", () => {
    expect(p("3br in Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("3 bd Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("3 bedroom homes in Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("2 bath homes in Pasadena")).toEqual({ query: "Pasadena", minBaths: "2" });
  });
  it("leaves place names and addresses that contain keywords alone", () => {
    expect(p("Home Gardens")).toEqual({ query: "Home Gardens" });
    expect(p("Indio")).toEqual({ query: "Indio" });
    expect(p("3 Bedford Ave")).toEqual({ query: "3 Bedford Ave" });
    expect(p("123 Main St")).toEqual({ query: "123 Main St" });
  });

  // Final review: the old reader kept whatever followed "in"/"near" as the
  // location; descriptive words before it must not leak into the city search.
  it("descriptive words before 'in {city}' are dropped, as before", () => {
    expect(p("luxury homes in Malibu")).toEqual({ query: "Malibu" });
    expect(p("single family homes in Pasadena")).toEqual({ query: "Pasadena" });
    expect(p("new listings in Pasadena")).toEqual({ query: "Pasadena" });
    expect(p("3 bedroom house with pool in Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("at least 3 beds in Pasadena")).toEqual({ query: "Pasadena", minBeds: "3" });
    expect(p("2 story home in Irvine")).toEqual({ query: "Irvine" });
  });
  it("a house number in front of a street named Bath/Bd is an address, not a filter", () => {
    expect(p("500 Bath St, Santa Barbara")).toEqual({ query: "500 Bath St, Santa Barbara" });
  });
});
