import { describe, it, expect } from "vitest";
import { buildMapboxStaticImageUrl } from "@/lib/mapbox-static";

describe("buildMapboxStaticImageUrl", () => {
  it("builds a satellite static image URL from lat/lng/token", () => {
    const url = buildMapboxStaticImageUrl({ lat: 37.96883, lng: -120.29765, token: "pk.test123" });
    expect(url).toBe(
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/-120.29765,37.96883,19/640x480@2x?access_token=pk.test123"
    );
  });

  it("respects custom width/height/zoom overrides", () => {
    const url = buildMapboxStaticImageUrl({ lat: 1, lng: 2, token: "pk.test", width: 320, height: 240, zoom: 17 });
    expect(url).toBe(
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/2,1,17/320x240@2x?access_token=pk.test"
    );
  });

  it("returns null when lat is null", () => {
    expect(buildMapboxStaticImageUrl({ lat: null, lng: -120.29765, token: "pk.test" })).toBeNull();
  });

  it("returns null when lng is null", () => {
    expect(buildMapboxStaticImageUrl({ lat: 37.96883, lng: null, token: "pk.test" })).toBeNull();
  });

  it("returns null when token is undefined", () => {
    expect(buildMapboxStaticImageUrl({ lat: 37.96883, lng: -120.29765, token: undefined })).toBeNull();
  });

  it("returns null when token is an empty string", () => {
    expect(buildMapboxStaticImageUrl({ lat: 37.96883, lng: -120.29765, token: "" })).toBeNull();
  });
});
