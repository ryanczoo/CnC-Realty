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
});
