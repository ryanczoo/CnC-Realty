import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { countCacheKey, redisReadOrNull } from "@/lib/property-count-cache";
import { buildLocationWhere } from "@/lib/property-search-query";
import { ACTIVE_STATUSES } from "@/lib/listing-status";

// Counting listings over the whole Property table takes 5–12 s, too slow to do while a visitor waits. An hourly
// job (api/cron/listing-counts) counts ahead of time instead:
//  - every city's active listings, read by the Home/Buy pages to pick the visitor's city (lib/visitor-city.ts)
//  - the "N homes" total for the searches the site links to, saved under the exact key the search page already
//    reads (lib/property-count-cache.ts), so the search page itself needs no change
// Saved values outlive a few missed runs; if they're ever gone, both pages count live exactly as before.

export { ACTIVE_STATUSES };

// The cities the Rent page links to (components/rent/RentCitiesSlider.tsx).
export const RENT_CITY_QUERIES = ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "San Jose"];

export const CITY_COUNTS_KEY = "listings:city-counts";
export const COUNTS_TTL_SECONDS = 3 * 60 * 60;
// Marks the city map as present, so a city missing from it reads as 0 rather than "no map saved".
const READY_FIELD = "__ready";

type ListingType = "FOR_SALE" | "FOR_RENT";

interface PresetSearch {
  listingType: ListingType;
  query?: string;
  where: Record<string, unknown>;
}

// The filter app/(listings)/properties/page.tsx builds for a search with only a listing type and a location.
function searchWhere(listingType: ListingType, query?: string): Record<string, unknown> {
  return {
    status: { in: ACTIVE_STATUSES },
    listingType,
    ...(query ? buildLocationWhere(query) : {}),
  };
}

export function presetSearches(): PresetSearch[] {
  return [
    { listingType: "FOR_SALE", where: searchWhere("FOR_SALE") },
    { listingType: "FOR_RENT", where: searchWhere("FOR_RENT") },
    ...RENT_CITY_QUERIES.map((query) => ({
      listingType: "FOR_RENT" as const,
      query,
      where: searchWhere("FOR_RENT", query),
    })),
  ];
}

interface GroupedCountRow {
  city: string | null;
  listingType: string | null;
  byListingType: number;
  n: number;
}

export async function refreshListingCounts(): Promise<{ cities: number; searches: number }> {
  // One pass over the active listings counts both every city and each listing type's total.
  const rows = await prisma.$queryRaw<GroupedCountRow[]>`
    SELECT lower(city) AS city, "listingType", GROUPING(lower(city))::int AS "byListingType", count(*)::int AS n
    FROM "Property"
    WHERE status IN (${ACTIVE_STATUSES[0]}, ${ACTIVE_STATUSES[1]}, ${ACTIVE_STATUSES[2]})
    GROUP BY GROUPING SETS ((lower(city)), ("listingType"))`;

  const cityCounts: Record<string, number> = {};
  const typeTotals: Record<string, number> = {};
  for (const row of rows) {
    if (row.byListingType === 1) {
      if (row.listingType) typeTotals[row.listingType] = row.n;
    } else if (row.city) {
      cityCounts[row.city] = row.n;
    }
  }

  // Written under a temporary key and renamed over the live one, so a reader never sees a half-written map.
  const tmpKey = `${CITY_COUNTS_KEY}:tmp`;
  await redis
    .multi()
    .hset(tmpKey, { ...cityCounts, [READY_FIELD]: 1 })
    .expire(tmpKey, COUNTS_TTL_SECONDS)
    .rename(tmpKey, CITY_COUNTS_KEY)
    .exec();

  const searches = presetSearches();
  for (const search of searches) {
    const total = search.query
      ? await prisma.property.count({ where: search.where })
      : typeTotals[search.listingType] ?? 0;
    await redis.setex(countCacheKey(search.where), COUNTS_TTL_SECONDS, total);
  }

  return { cities: Object.keys(cityCounts).length, searches: searches.length };
}

// The city's saved active-listing count (matched case-insensitively, like the live count), or null when no map
// is saved or Redis can't answer in time — the caller then counts live.
export async function getCachedCityCount(city: string): Promise<number | null> {
  const field = city.toLowerCase();
  const saved = await redisReadOrNull(
    () => redis.hmget<Record<string, number | null>>(CITY_COUNTS_KEY, field, READY_FIELD),
    "listing-counts",
  );
  if (!saved || saved[READY_FIELD] == null) return null;
  return Number(saved[field] ?? 0);
}
