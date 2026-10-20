import { describe, it, expect } from "vitest";
import {
  propertyJsonLd,
  agentJsonLd,
  localBusinessJsonLd,
  websiteJsonLd,
  jsonLdScriptSafe,
} from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

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
  status: "Active",
};

describe("propertyJsonLd", () => {
  it("includes an offer (with price) while the listing is on the market", () => {
    for (const status of ["Active", "ComingSoon", "ActiveUnderContract"]) {
      expect(propertyJsonLd({ ...baseProperty, status }).offers).toEqual({
        "@type": "Offer",
        price: 850_000,
        priceCurrency: "USD",
      });
    }
  });

  it("omits offers entirely for Closed and Pending listings", () => {
    for (const status of ["Closed", "Pending"]) {
      expect(propertyJsonLd({ ...baseProperty, status })).not.toHaveProperty("offers");
    }
  });

  it("sets @type to RealEstateListing", () => {
    expect(propertyJsonLd(baseProperty)["@type"]).toBe("RealEstateListing");
  });

  it("includes the listing price in offers", () => {
    const result = propertyJsonLd(baseProperty);
    expect(result.offers?.price).toBe(850_000);
    expect(result.offers?.priceCurrency).toBe("USD");
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

  it("names the brokerage CnC Realty", () => {
    const result = agentJsonLd({ name: "Ryan Chong", slug: "ryan-chong", bio: null, headshot: null, phone: null });
    expect(result.worksFor.name).toBe("CnC Realty");
  });
});

describe("localBusinessJsonLd", () => {
  const biz = localBusinessJsonLd();

  it("sets @type to RealEstateAgent", () => {
    expect(biz["@type"]).toBe("RealEstateAgent");
  });

  it("uses the CnC Realty brand, url, logo, image and email", () => {
    expect(biz.name).toBe("CnC Realty");
    expect(biz.legalName).toBe("CnC Realty");
    expect(biz.url).toBe(SITE_URL);
    expect(biz.logo).toBe(`${SITE_URL}/logo-black.png`);
    expect(biz.image).toBe(`${SITE_URL}/og-default.jpg`);
    expect(biz.email).toBe("info@cncrealtygroup.com");
  });

  it("has the Santa Ana office address", () => {
    expect(biz.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "830 S. Main St, STE 227",
      addressLocality: "Santa Ana",
      addressRegion: "CA",
      postalCode: "92701",
      addressCountry: "US",
    });
  });

  it("serves the state of California", () => {
    expect(biz.areaServed).toEqual({ "@type": "State", name: "California" });
  });

  it("lists the three social profiles and the DRE license", () => {
    expect(biz.sameAs).toEqual([
      "https://www.facebook.com/CnCRealtyGroup",
      "https://www.instagram.com/cncrealty",
      "https://www.youtube.com/@CnCRealtyGroup",
    ]);
    expect(biz.identifier).toEqual({ "@type": "PropertyValue", name: "CA DRE License", value: "02439028" });
  });

  it("has no telephone and never mentions Los Angeles or CnC Realty Group", () => {
    expect("telephone" in biz).toBe(false);
    const json = JSON.stringify(biz);
    expect(json).not.toContain("Los Angeles");
    expect(json).not.toContain("CnC Realty Group");
  });
});

describe("websiteJsonLd", () => {
  it("describes the WebSite", () => {
    expect(websiteJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "CnC Realty",
      url: SITE_URL,
    });
  });
});

describe("jsonLdScriptSafe", () => {
  it("neutralizes a </script> sequence so it cannot close the surrounding script tag", () => {
    const malicious = agentJsonLd({
      name: "Jane",
      slug: "jane",
      bio: '</script><script>alert(1)</script>',
      headshot: null,
      phone: null,
    });
    const safe = jsonLdScriptSafe(malicious);
    expect(safe).not.toContain("</script>");
    expect(safe).toContain("\\u003c/script\\u003e");
  });
});
