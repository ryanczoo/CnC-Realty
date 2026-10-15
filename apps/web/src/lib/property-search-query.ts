import { Prisma } from "@cnc/database";
import { CA_COUNTIES, BAY_AREA_COUNTIES } from "@/lib/ca-counties";

// Trailing pieces people add the way Zillow/Google take a location
// ("Monterey Park, CA, USA"). None are stored on a listing, so they're dropped.
const COUNTRY_END = /(?:^|[\s,]+)(?:usa|united states(?: of america)?)$/i;
const STATE_END = /(?:^|[\s,]+)(?:ca|calif\.?|california)$/i;
const ZIP_END = /(?:^|[\s,]+)(\d{5})(?:-\d{4})?$/;
const ZIP_ONLY = /^\d{5}(?:-\d{4})?$/;

// Street types. Ignored when matching an address — listings spell them
// inconsistently ("Lincoln Avenue", "Marguerita Ave", "Sefton") — and used to
// split "Atlantic Blvd Monterey Park" into street + city.
const STREET_TYPES = new Set([
  "st", "street", "ave", "av", "avenue", "blvd", "boulevard", "rd", "road", "dr", "drive", "ln", "lane",
  "ct", "court", "pl", "place", "way", "ter", "terrace", "cir", "circle", "pkwy", "parkway", "hwy", "highway",
]);
const DIRECTIONS = new Set([
  "n", "s", "e", "w", "ne", "nw", "se", "sw",
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
]);
// "Unit 100", "Apt 100", "Ste 100", "#100" at the end; stored as "#100"
const UNIT_END = /(?:^|\s)(?:#|unit|apt|apartment|ste|suite)\s*#?\s*([a-z0-9-]+)$/i;

const insensitive = (contains: string) => ({ contains, mode: "insensitive" as const });

// A place name matches the city or the MLS neighborhood ("Silver Lake" is a
// neighborhood of the city "Los Angeles").
function cityOrArea(text: string): Prisma.PropertyWhereInput {
  return { OR: [{ city: insensitive(text) }, { area: insensitive(text) }] };
}

// Drops country/state, pulling out a trailing ZIP if there is one.
function stripRegion(s: string): { text: string; zip?: string } {
  let text = s.replace(COUNTRY_END, "");
  let zip: string | undefined;
  const takeZip = () => {
    const m = text.match(ZIP_END);
    if (m && !zip) { zip = m[1]; text = text.slice(0, m.index); }
  };
  takeZip();
  text = text.replace(STATE_END, "");
  takeZip();
  return { text: text.replace(/[\s,]+$/, "").trim(), zip };
}

// "328 North Lincoln Ave #4" → starts with "328 ", contains "Lincoln", contains "#4"
function addressWhere(street: string, city?: string): Prisma.PropertyWhereInput {
  let s = street.replace(/\./g, " ").replace(/\s+/g, " ").trim();
  let unit: string | undefined;
  const u = s.match(UNIT_END);
  if (u) { unit = u[1]; s = s.slice(0, u.index).trim(); }
  const [num, ...words] = s.split(" ");
  if (words.length && STREET_TYPES.has(words[words.length - 1].toLowerCase())) words.pop();
  if (words.length > 1 && DIRECTIONS.has(words[0].toLowerCase())) words.shift();
  if (!words.length && !unit && !city) return { address: insensitive(s) };
  const and: Prisma.PropertyWhereInput[] = [{ address: { startsWith: `${num} `, mode: "insensitive" } }];
  if (words.length) and.push({ address: insensitive(words.join(" ")) });
  if (unit) and.push({ address: insensitive(`#${unit}`) });
  if (city) and.push(cityOrArea(city));
  return { AND: and };
}

function placeWhere(place: string, cityHint?: string): Prisma.PropertyWhereInput {
  const lower = place.toLowerCase();
  if (lower === "bay area") return { county: { in: [...BAY_AREA_COUNTIES] } };
  const county = lower.match(/^(.+?) county$/);
  if (county) {
    const name = CA_COUNTIES.find((c) => c.toLowerCase() === county[1]);
    if (name) return { county: name };
  }
  const words = place.split(" ");
  // "Atlantic Blvd Monterey Park" / "Atlantic Blvd, Monterey Park": street + city.
  // A bare name ending in a street word stays a place search ("Lake View
  // Terrace" is a neighborhood) — letter-led text never matches addresses on
  // its own, or "Cerritos" would pull in Cerritos Ave in other cities.
  const t = words.findIndex((w, i) => i > 0 && STREET_TYPES.has(w.toLowerCase()));
  const city = t > 0 ? words.slice(t + 1).join(" ") || cityHint : undefined;
  if (t > 0 && city) return { AND: [{ address: insensitive(words.slice(0, t).join(" ")) }, cityOrArea(city)] };
  return cityOrArea(place);
}

export function buildLocationWhere(raw: string): Prisma.PropertyWhereInput {
  const q = raw.replace(/\s+/g, " ").trim();
  const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
  const first = parts[0] ?? q;

  if (ZIP_ONLY.test(first)) return { zip: first.slice(0, 5) };
  // "123 Main St, Monterey Park, CA" — the street, plus the city if given
  if (/^\d/.test(first) && parts.length > 1) {
    const city = stripRegion(parts.slice(1).join(", ")).text.split(",")[0].trim();
    return addressWhere(first, city || undefined);
  }

  const { text, zip } = stripRegion(q);
  if (zip) return { zip };
  const [place = "", cityHint] = text.split(",").map((s) => s.trim());
  if (!place) return cityOrArea(q);
  if (/^\d/.test(place)) return addressWhere(place);
  return placeWhere(place, cityHint || undefined);
}
