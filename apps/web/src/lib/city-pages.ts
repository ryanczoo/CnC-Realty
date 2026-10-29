import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { redisReadOrNull } from "@/lib/property-count-cache";
import { ACTIVE_STATUSES } from "@/lib/listing-status";
import { canonicalMeta } from "@/lib/seo";

// City search pages (/homes-for-sale/<city>): a city gets a page while it has at least CITY_PAGE_MIN_LISTINGS
// active for-sale listings in one of the counties below. A daily job (api/cron/city-pages) saves the list to Redis,
// so the pages, the nearby-city links and the sitemap never count listings while a visitor waits.

export const CITY_PAGE_COUNTIES = ["Los Angeles", "Orange", "Riverside", "San Bernardino", "San Diego", "Ventura"];
export const CITY_PAGE_MIN_LISTINGS = 20;
export const CITY_PAGES_KEY = "listings:city-pages";
const CITY_PAGES_TTL_SECONDS = 3 * 24 * 60 * 60;

export interface CityPage {
  slug: string;
  name: string;
  county: string;
  count: number;
  lat: number;
  lng: number;
}

export function citySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function distanceKm(a: CityPage, b: CityPage): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearbyCities(city: CityPage, all: CityPage[], n = 6): CityPage[] {
  return all
    .filter((c) => c.slug !== city.slug)
    .map((c) => ({ c, d: distanceKm(city, c) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map(({ c }) => c);
}

interface CityRow {
  name: string;
  county: string;
  n: number;
  lat: number;
  lng: number;
}

export async function refreshCityPages(): Promise<{ cities: number }> {
  // One pass over the active for-sale listings in the six counties: most common spelling of each city, its count,
  // and its centre point (for the nearby-city links).
  const rows = await prisma.$queryRaw<CityRow[]>`
    SELECT mode() WITHIN GROUP (ORDER BY city) AS name,
           mode() WITHIN GROUP (ORDER BY county) AS county,
           count(*)::int AS n,
           avg(latitude)::float8 AS lat,
           avg(longitude)::float8 AS lng
    FROM "Property"
    WHERE status IN (${ACTIVE_STATUSES[0]}, ${ACTIVE_STATUSES[1]}, ${ACTIVE_STATUSES[2]})
      AND "listingType" = 'FOR_SALE'
      AND county IN (${CITY_PAGE_COUNTIES[0]}, ${CITY_PAGE_COUNTIES[1]}, ${CITY_PAGE_COUNTIES[2]},
                     ${CITY_PAGE_COUNTIES[3]}, ${CITY_PAGE_COUNTIES[4]}, ${CITY_PAGE_COUNTIES[5]})
      AND latitude IS NOT NULL AND longitude IS NOT NULL
    GROUP BY lower(city)`;

  const list: CityPage[] = rows
    .filter((r) => r.n >= CITY_PAGE_MIN_LISTINGS && r.name && citySlug(r.name))
    .map((r) => ({ slug: citySlug(r.name), name: r.name, county: r.county, count: r.n, lat: r.lat, lng: r.lng }));

  await redis.set(CITY_PAGES_KEY, JSON.stringify(list), { ex: CITY_PAGES_TTL_SECONDS });
  return { cities: list.length };
}

// The saved list, or null when it's missing or Redis can't answer in time.
export async function getCityPages(): Promise<CityPage[] | null> {
  const saved = await redisReadOrNull(() => redis.get<CityPage[] | string>(CITY_PAGES_KEY), "city-pages");
  if (saved == null) return null;
  return typeof saved === "string" ? (JSON.parse(saved) as CityPage[]) : saved;
}

export function cityPageMeta(city: CityPage): Metadata {
  return canonicalMeta(
    `/homes-for-sale/${city.slug}`,
    `Homes for Sale in ${city.name}, CA`,
    `Browse ${city.count}+ homes for sale in ${city.name}, CA, updated from the MLS every 15 minutes.`,
  );
}
