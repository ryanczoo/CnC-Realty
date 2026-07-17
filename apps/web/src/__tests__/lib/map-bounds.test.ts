import { describe, it, expect } from "vitest";
import { getPropertiesBounds } from "@/lib/map-bounds";

describe("getPropertiesBounds", () => {
  it("returns null for an empty array", () => {
    expect(getPropertiesBounds([])).toBeNull();
  });

  it("returns null when no property has valid coordinates", () => {
    const props = [
      { latitude: null, longitude: null },
      { latitude: null, longitude: -118.1 },
      { latitude: 33.9, longitude: null },
    ];
    expect(getPropertiesBounds(props)).toBeNull();
  });

  it("returns a degenerate bbox (same point twice) for a single valid point", () => {
    const props = [{ latitude: 33.8583, longitude: -118.0648 }];
    expect(getPropertiesBounds(props)).toEqual([
      [-118.0648, 33.8583],
      [-118.0648, 33.8583],
    ]);
  });

  it("returns the min/max lng/lat bounds across multiple points", () => {
    const props = [
      { latitude: 33.8583, longitude: -118.0648 }, // Cerritos
      { latitude: 34.0522, longitude: -118.2437 }, // LA
      { latitude: 33.6846, longitude: -117.8265 }, // Anaheim
    ];
    expect(getPropertiesBounds(props)).toEqual([
      [-118.2437, 33.6846],
      [-117.8265, 34.0522],
    ]);
  });

  it("ignores properties with null coordinates mixed in with valid ones", () => {
    const props = [
      { latitude: 33.8583, longitude: -118.0648 },
      { latitude: null, longitude: null },
      { latitude: 34.0522, longitude: -118.2437 },
    ];
    expect(getPropertiesBounds(props)).toEqual([
      [-118.2437, 33.8583],
      [-118.0648, 34.0522],
    ]);
  });
});
