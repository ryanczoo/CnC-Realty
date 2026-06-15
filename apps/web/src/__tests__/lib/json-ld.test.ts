import { describe, it, expect } from "vitest";
import { propertyJsonLd, agentJsonLd, localBusinessJsonLd } from "@/lib/json-ld";

const baseProperty = {
  mlsNumber: "A12345",
  address: "123 Main St",
  city: "Pasadena",
  state: "CA",
  zip: "91101",
  listPrice: 850_000,
  beds: 3,
  baths: 2.0,
  sqft: 2000,
  description: "A beautiful home.",
  photos: ["https://cdn.example.com/photo1.jpg"],
  latitude: 34.1478,
  longitude: -118.1445,
};

describe("propertyJsonLd", () => {
  it("sets @type to RealEstateListing", () => {
    expect(propertyJsonLd(baseProperty)["@type"]).toBe("RealEstateListing");
  });

  it("includes the listing price in offers", () => {
    const result = propertyJsonLd(baseProperty);
    expect(result.offers.price).toBe(850_000);
    expect(result.offers.priceCurrency).toBe("USD");
  });

  it("builds the canonical URL from mlsNumber", () => {
    expect(propertyJsonLd(baseProperty).url).toBe(
      "https://cncrealtygroup.com/properties/A12345"
    );
  });

  it("includes geo coordinates when present", () => {
    const result = propertyJsonLd(baseProperty);
    expect(result.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 34.1478,
      longitude: -118.1445,
    });
  });

  it("omits geo when coordinates are null", () => {
    const result = propertyJsonLd({ ...baseProperty, latitude: null, longitude: null });
    expect(result.geo).toBeUndefined();
  });

  it("omits floorSize when sqft is null", () => {
    const result = propertyJsonLd({ ...baseProperty, sqft: null });
    expect(result.floorSize).toBeUndefined();
  });
});

describe("agentJsonLd", () => {
  it("sets @type to Person", () => {
    const result = agentJsonLd({ name: "Ryan Chong", slug: "ryan-chong", bio: null, headshot: null, phone: null });
    expect(result["@type"]).toBe("Person");
    expect(result.url).toBe("https://cncrealtygroup.com/agents/ryan-chong");
  });
});

describe("localBusinessJsonLd", () => {
  it("sets @type to RealEstateAgent", () => {
    expect(localBusinessJsonLd()["@type"]).toBe("RealEstateAgent");
  });
});
