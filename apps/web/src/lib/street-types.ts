// Street-type words, shared by the typed-text reader (property-search.ts) and
// the location matcher (property-search-query.ts). Listings spell them
// inconsistently ("Lincoln Avenue", "Marguerita Ave", "Sefton").
export const STREET_TYPES: ReadonlySet<string> = new Set([
  "st", "street", "ave", "av", "avenue", "blvd", "boulevard", "rd", "road", "dr", "drive", "ln", "lane",
  "ct", "court", "pl", "place", "way", "ter", "terrace", "cir", "circle", "pkwy", "parkway", "hwy", "highway",
]);
