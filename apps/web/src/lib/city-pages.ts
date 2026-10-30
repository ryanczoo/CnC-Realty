import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
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

  // Spelling variants ("La Cañada"/"La Canada") make the same address: merge them, keeping the bigger group's name
  // and a count-weighted centre.
  const bySlug = new Map<string, CityPage & { top: number }>();
  for (const r of rows) {
    const slug = r.name ? citySlug(r.name) : "";
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (!prev) {
      bySlug.set(slug, { slug, name: r.name, county: r.county, count: r.n, lat: r.lat, lng: r.lng, top: r.n });
      continue;
    }
    const count = prev.count + r.n;
    prev.lat = (prev.lat * prev.count + r.lat * r.n) / count;
    prev.lng = (prev.lng * prev.count + r.lng * r.n) / count;
    prev.count = count;
    if (r.n > prev.top) Object.assign(prev, { name: r.name, county: r.county, top: r.n });
  }
  const list: CityPage[] = Array.from(bySlug.values())
    .filter((c) => c.count >= CITY_PAGE_MIN_LISTINGS)
    .map((c) => ({ slug: c.slug, name: c.name, county: c.county, count: c.count, lat: c.lat, lng: c.lng }));

  await redis.set(CITY_PAGES_KEY, JSON.stringify(list), { ex: CITY_PAGES_TTL_SECONDS });
  return { cities: list.length };
}

const READ_TIMEOUT_MS = 2000;

// The saved list, or null when none is saved. Throws when Redis can't answer, so a city page returns a server
// error (search engines retry) rather than "not found" (search engines drop the page).
export async function getCityPages(): Promise<CityPage[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const saved = await Promise.race([
    redis.get<CityPage[] | string>(CITY_PAGES_KEY),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("city-pages: Redis read timed out")), READ_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
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
