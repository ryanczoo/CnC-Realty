// Reads what people type into the homepage, Buy page and search-page bars the
// way Zillow does ("condos in Pasadena under 800k", "3br", "for rent") and turns
// it into the filter params the search page already understands. Whatever is
// left is the location, handed to buildLocationWhere on the server.
import { STREET_TYPES } from "@/lib/street-types";

const AMOUNT = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|mil|million)?\b`;
const BETWEEN = new RegExp(String.raw`\bbetween\s+${AMOUNT}\s+(?:and|to)\s+${AMOUNT}`, "i");
const UNDER = new RegExp(String.raw`\b(?:under|below|less than|up to|max)\s+${AMOUNT}`, "i");
const OVER = new RegExp(String.raw`\b(?:over|above|more than|at least|min)\s+${AMOUNT}`, "i");
const BEDS = /\b(\d+)\s*-?\s*(?:bedrooms?|beds?|bdrms?|bds?|brs?)\b/i;
const BATHS = /\b(\d+(?:\.5)?)\s*-?\s*(?:bathrooms?|baths?|ba)\b/i;
const RENT = /\b(?:for\s+(?:rent|lease)|rentals?)\b/i;
const SALE = /\bfor\s+sale\b/i;
const CONDO = /\bcondo(?:minium)?s?\b/i;
const TOWNHOUSE = /\btown\s?(?:home|house)s?\b/i;
const FILLER = /\b(?:homes|houses|house|properties|listings|real estate|apartments|with)\b/gi;
// Singular "home" only where it can't be a place name ("Home Gardens")
const HOME = /\bhome\b(?=\s+(?:in|near|around|for)\b|\s*$)/gi;
const PLACE_AFTER = /\b(?:in|near|around)\s+(\S.*)$/i;
const LEAD = /^(?:in|near|around)\s+/i;
const TRAIL = /\s+(?:in|near|around)$/i;

function toDollars(n: string, unit?: string): number | null {
  const v = parseFloat(n.replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  if (!unit) return v >= 1000 ? Math.round(v) : null; // a bare "800" isn't a price
  return Math.round(v * (unit.toLowerCase() === "k" ? 1_000 : 1_000_000));
}

export function buildPropertySearchParams(raw: string): URLSearchParams {
  const params = new URLSearchParams();
  let t = ` ${raw} `;
  // Removes the matched phrase only when `use` accepts it
  const cut = (re: RegExp, use: (m: RegExpMatchArray) => boolean) => {
    const m = t.match(re);
    if (m && use(m)) t = `${t.slice(0, m.index)} ${t.slice(m.index! + m[0].length)}`;
  };

  cut(BETWEEN, (m) => {
    const lo = toDollars(m[1], m[2] ?? m[4]), hi = toDollars(m[3], m[4]);
    if (!lo || !hi) return false;
    params.set("minPrice", String(lo)); params.set("maxPrice", String(hi)); return true;
  });
  cut(UNDER, (m) => { const v = toDollars(m[1], m[2]); if (!v) return false; params.set("maxPrice", String(v)); return true; });
  cut(OVER, (m) => { const v = toDollars(m[1], m[2]); if (!v) return false; params.set("minPrice", String(v)); return true; });
  // "500 Bath St" is a house number + a street named Bath, not "500 baths"
  const isStreetName = (m: RegExpMatchArray) => {
    const nextWord = t.slice(m.index! + m[0].length).trim().split(/[\s,]+/)[0]?.toLowerCase() ?? "";
    return !t.slice(0, m.index).trim() && STREET_TYPES.has(nextWord);
  };
  cut(BEDS, (m) => { if (isStreetName(m)) return false; params.set("minBeds", m[1]); return true; });
  cut(BATHS, (m) => { if (isStreetName(m)) return false; params.set("minBaths", m[1]); return true; });
  cut(RENT, () => { params.set("listingType", "FOR_RENT"); return true; });
  cut(SALE, () => { params.set("listingType", "FOR_SALE"); return true; });
  cut(CONDO, () => { params.set("propertyType", "Condominium"); return true; });
  cut(TOWNHOUSE, () => { params.set("propertyType", "Townhouse"); return true; });

  // "luxury homes in Malibu": whatever follows in/near/around is the place
  // (as the old reader did); otherwise strip the filler words around it.
  const tail = t.match(PLACE_AFTER);
  const location = (tail ? tail[1] : t).replace(FILLER, " ").replace(HOME, " ").replace(/\s+/g, " ").trim()
    .replace(LEAD, "").replace(TRAIL, "").trim();
  if (location) params.set("query", location);
  return params;
}
