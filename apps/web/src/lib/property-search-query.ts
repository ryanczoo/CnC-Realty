import { Prisma } from "@cnc/database";

// Trailing pieces people add the way Zillow/Google take a location
// ("Monterey Park, CA, USA"). None of them are stored on a listing, so they
// are dropped before searching.
const COUNTRY_END = /(?:^|[\s,]+)(?:usa|united states(?: of america)?)$/i;
const STATE_END = /(?:^|[\s,]+)(?:ca|calif\.?|california)$/i;
const ZIP_END = /(?:^|[\s,]+)(\d{5})(?:-\d{4})?$/;
const ZIP_ONLY = /^\d{5}(?:-\d{4})?$/;

const insensitive = (contains: string) => ({ contains, mode: "insensitive" as const });

export function buildLocationWhere(raw: string): Prisma.PropertyWhereInput {
  const q = raw.replace(/\s+/g, " ").trim();
  const first = q.split(",")[0].trim();

  if (ZIP_ONLY.test(first)) return { zip: first.slice(0, 5) };
  // "123 Main St, Monterey Park, CA" — the street is the part that matches the address column
  if (/^\d/.test(first) && q.includes(",")) return { address: insensitive(first) };

  let rest = q.replace(COUNTRY_END, "");
  let zip = rest.match(ZIP_END);
  if (zip) return { zip: zip[1] };
  rest = rest.replace(STATE_END, "");
  zip = rest.match(ZIP_END);
  if (zip) return { zip: zip[1] };

  const place = rest.split(",")[0].trim() || q;
  if (/^\d/.test(place)) return { address: insensitive(place) };
  return { city: insensitive(place) };
}
