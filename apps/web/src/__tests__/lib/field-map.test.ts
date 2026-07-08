import { describe, it, expect } from "vitest";
import { mapResoToProperty } from "@/lib/idx/field-map";

function baseRaw() {
  return {
    ListingKey: "ML123",
    StandardStatus: "Closed",
    ListPrice: 1000000,
    StreetNumber: "123",
    StreetName: "Main",
    StreetSuffix: "St",
    City: "Pasadena",
    PostalCode: "91101",
  };
}

describe("mapResoToProperty — ClosePrice/CloseDate", () => {
  it("maps ClosePrice to closePrice", () => {
    const result = mapResoToProperty({ ...baseRaw(), ClosePrice: 985000 } as any);
    expect(result.closePrice).toBe(985000);
  });

  it("maps CloseDate to a closeDate Date object", () => {
    const result = mapResoToProperty({ ...baseRaw(), CloseDate: "2026-05-10" } as any);
    expect(result.closeDate).toBeInstanceOf(Date);
    expect(result.closeDate?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  it("defaults closePrice and closeDate to null when absent", () => {
    const result = mapResoToProperty(baseRaw() as any);
    expect(result.closePrice).toBeNull();
    expect(result.closeDate).toBeNull();
  });
});
