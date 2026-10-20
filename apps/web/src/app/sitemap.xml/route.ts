import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/listing-status";
import { cachedCount, countCacheKey } from "@/lib/property-count-cache";
import {
  listingSitemapCount,
  sitemapIndexXml,
  sitemapUrl,
  XML_RESPONSE_HEADERS,
} from "@/lib/sitemap";

// A route with no parameters would be prerendered at build time, and the build machine cannot
// reach the database (that is why the old sitemap came out empty). So it renders on every request.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The same filter, per listing type, as the /properties page's default search. The hourly
// listing-counts cron saves these totals under exactly this cache key, so the count is a Redis read.
async function activeCount(listingType: "FOR_SALE" | "FOR_RENT"): Promise<number> {
  const where = { status: { in: ACTIVE_STATUSES }, listingType };
  return cachedCount(countCacheKey(where), () => prisma.property.count({ where }));
}

export async function GET() {
  const locs = [sitemapUrl("pages.xml")];
  try {
    const counts = await Promise.all([activeCount("FOR_SALE"), activeCount("FOR_RENT")]);
    const total = counts[0] + counts[1];
    for (let i = 0; i < listingSitemapCount(total); i++) locs.push(sitemapUrl(`listings-${i}.xml`));
  } catch (err) {
    console.error("[sitemap] index count failed:", err);
  }
  return new Response(sitemapIndexXml(locs), { headers: XML_RESPONSE_HEADERS });
}
