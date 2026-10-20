import { SITE_URL, BRAND, OG_IMAGE } from "@/lib/seo";

export function propertyJsonLd(p: {
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  photos: string[] | null;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.address,
    url: `${SITE_URL}/properties/${p.mlsNumber}`,
    ...(p.description ? { description: p.description } : {}),
    ...(p.photos?.length ? { image: p.photos.slice(0, 5) } : {}),
    ...(p.beds !== null ? { numberOfRooms: p.beds } : {}),
    ...(p.sqft !== null
      ? { floorSize: { "@type": "QuantitativeValue", value: p.sqft, unitCode: "SQFT" } }
      : {}),
    offers: { "@type": "Offer", price: p.listPrice, priceCurrency: "USD" },
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address,
      addressLocality: p.city,
      addressRegion: p.state,
      postalCode: p.zip,
      addressCountry: "US",
    },
    ...(p.latitude !== null && p.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude } }
      : {}),
  };
}

export function agentJsonLd(a: {
  name: string;
  slug: string;
  bio: string | null;
  headshot: string | null;
  phone: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: a.name,
    url: `${SITE_URL}/agents/${a.slug}`,
    jobTitle: "Real Estate Agent",
    ...(a.bio ? { description: a.bio } : {}),
    ...(a.headshot ? { image: a.headshot } : {}),
    ...(a.phone ? { telephone: a.phone } : {}),
    worksFor: { "@type": "RealEstateAgent", name: BRAND, url: SITE_URL },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: BRAND,
    legalName: BRAND,
    url: SITE_URL,
    logo: `${SITE_URL}/logo-black.png`,
    image: `${SITE_URL}${OG_IMAGE.url}`,
    email: "info@cncrealtygroup.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "830 S. Main St, STE 227",
      addressLocality: "Santa Ana",
      addressRegion: "CA",
      postalCode: "92701",
      addressCountry: "US",
    },
    areaServed: { "@type": "State", name: "California" },
    sameAs: [
      "https://www.facebook.com/CnCRealtyGroup",
      "https://www.instagram.com/cncrealty",
      "https://www.youtube.com/@CnCRealtyGroup",
    ],
    identifier: { "@type": "PropertyValue", name: "CA DRE License", value: "02439028" },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: SITE_URL,
  };
}

// Every caller that embeds one of this file's objects into a
// <script type="application/ld+json"> tag via dangerouslySetInnerHTML must
// run the stringified result through this first. JSON.stringify alone does
// not escape "<" or ">", so a "</script>" sequence inside attacker-controlled
// text (an agent's bio, an MLS description) can close the script tag early
// and inject a sibling <script> that the browser executes. Both angle
// brackets are escaped as \uXXXX sequences, which remain valid JSON string
// content and parse back to the original characters for any consumer
// (search engine crawlers, JSON.parse) that reads the script tag's text.
export function jsonLdScriptSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/[<>]/g, (c) => (c === "<" ? "\\u003c" : "\\u003e"));
}
