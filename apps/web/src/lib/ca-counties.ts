// Spelled exactly as CRMLS stores Property.county (checked against the DB
// 2026-10-15), so a typed "Orange County" can match with a plain indexed equals.
export const CA_COUNTIES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte", "El Dorado",
  "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake", "Lassen", "Los Angeles",
  "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada",
  "Orange", "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino", "San Diego",
  "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara",
  "Santa Cruz", "Shasta", "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama",
  "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba",
] as const;

// Zillow's "Bay Area" region; the standard nine-county definition (Ryan, 2026-10-15).
export const BAY_AREA_COUNTIES = [
  "Alameda", "Contra Costa", "Marin", "Napa", "San Francisco", "San Mateo", "Santa Clara", "Solano", "Sonoma",
] as const;
