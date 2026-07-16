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

describe("mapResoToProperty — photos filtering by MediaClassification", () => {
  it("excludes a media entry classified as DOCUMENT even when it sorts first by Order", () => {
    const result = mapResoToProperty({
      ...baseRaw(),
      Media: [
        { MediaURL: "https://x/doc.pdf", Order: 1, MediaClassification: "DOCUMENT" },
        { MediaURL: "https://x/photo.jpg", Order: 2, MediaClassification: "PHOTO" },
      ],
    } as any);
    expect(result.photos).toEqual(["https://x/photo.jpg"]);
  });

  it("includes media with no MediaClassification at all (defensive default for MLS boards that don't populate it)", () => {
    const result = mapResoToProperty({
      ...baseRaw(),
      Media: [{ MediaURL: "https://x/photo.jpg", Order: 1 }],
    } as any);
    expect(result.photos).toEqual(["https://x/photo.jpg"]);
  });

  it("returns an empty array when every media entry is a non-photo document", () => {
    const result = mapResoToProperty({
      ...baseRaw(),
      Media: [{ MediaURL: "https://x/doc.pdf", Order: 1, MediaClassification: "DOCUMENT" }],
    } as any);
    expect(result.photos).toEqual([]);
  });

  it("keeps multiple real photos sorted by Order, unaffected by filtering", () => {
    const result = mapResoToProperty({
      ...baseRaw(),
      Media: [
        { MediaURL: "https://x/b.jpg", Order: 2, MediaClassification: "PHOTO" },
        { MediaURL: "https://x/a.jpg", Order: 1, MediaClassification: "PHOTO" },
      ],
    } as any);
    expect(result.photos).toEqual(["https://x/a.jpg", "https://x/b.jpg"]);
  });
});
