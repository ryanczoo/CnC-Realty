const BASE = "https://cncrealtygroup.com";

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
    url: `${BASE}/properties/${p.mlsNumber}`,
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
    url: `${BASE}/agents/${a.slug}`,
    jobTitle: "Real Estate Agent",
    ...(a.bio ? { description: a.bio } : {}),
    ...(a.headshot ? { image: a.headshot } : {}),
    ...(a.phone ? { telephone: a.phone } : {}),
    worksFor: { "@type": "RealEstateAgent", name: "CnC Realty Group", url: BASE },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "CnC Realty Group",
    url: BASE,
    logo: `${BASE}/logo-white.png`,
    email: "info@cncrealtygroup.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Los Angeles",
      addressRegion: "CA",
      addressCountry: "US",
    },
    areaServed: "California",
  };
}
