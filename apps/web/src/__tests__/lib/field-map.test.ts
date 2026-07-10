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

describe("mapResoToProperty — directional prefix/suffix in address", () => {
  it("includes StreetDirPrefix in the address, right after the street number", () => {
    const result = mapResoToProperty({ ...baseRaw(), StreetDirPrefix: "N" } as any);
    expect(result.address).toBe("123 N Main St");
  });

  it("includes StreetDirSuffix in the address, after the street suffix", () => {
    const result = mapResoToProperty({ ...baseRaw(), StreetDirSuffix: "NE" } as any);
    expect(result.address).toBe("123 Main St NE");
  });

  it("includes both a directional prefix and suffix together", () => {
    const result = mapResoToProperty({
      ...baseRaw(),
      StreetDirPrefix: "N",
      StreetDirSuffix: "NE",
    } as any);
    expect(result.address).toBe("123 N Main St NE");
  });

  it("omits directional words entirely when the RESO data has none (existing behavior unchanged)", () => {
    const result = mapResoToProperty(baseRaw() as any);
    expect(result.address).toBe("123 Main St");
  });
});
