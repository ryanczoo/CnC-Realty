import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/listing-status";
import {
  listingSitemapCount,
  sitemapIndexXml,
  sitemapUrl,
  XML_RESPONSE_HEADERS,
} from "@/lib/sitemap";

// A route with no parameters would be prerendered at build time, and the build machine cannot
// reach the database (that is why the old sitemap came out empty). So it renders on every request
// and the count is cached for an hour instead.
export const dynamic = "force-dynamic";

const activeListingCount = unstable_cache(
  () => prisma.property.count({ where: { status: { in: ACTIVE_STATUSES } } }),
  ["sitemap-active-listing-count"],
  { revalidate: 3600 },
);

export async function GET() {
  const locs = [sitemapUrl("pages.xml")];
  try {
    const total = await activeListingCount();
    for (let i = 0; i < listingSitemapCount(total); i++) locs.push(sitemapUrl(`listings-${i}.xml`));
  } catch (err) {
    console.error("[sitemap] index count failed:", err);
  }
  return new Response(sitemapIndexXml(locs), { headers: XML_RESPONSE_HEADERS });
}
