import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/listing-status";
import { SITE_URL } from "@/lib/seo";
import {
  EXCLUDED_AGENT_SLUGS,
  LISTINGS_PER_SITEMAP,
  STATIC_SITEMAP_PATHS,
  urlsetXml,
  XML_RESPONSE_HEADERS,
} from "@/lib/sitemap";

// Nothing is prerendered at build (the build machine cannot reach the database); each file is
// rendered on its first request and then cached for an hour.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Entry = { loc: string; lastmod?: Date };

async function pagesEntries(): Promise<Entry[]> {
  const entries: Entry[] = STATIC_SITEMAP_PATHS.map((p) => ({ loc: `${SITE_URL}${p}` }));
  try {
    const [agents, posts] = await Promise.all([
      prisma.agent.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    ]);
    for (const a of agents) {
      if (a.slug && !EXCLUDED_AGENT_SLUGS.includes(a.slug)) {
        entries.push({ loc: `${SITE_URL}/agents/${a.slug}`, lastmod: a.updatedAt });
      }
    }
    for (const p of posts) entries.push({ loc: `${SITE_URL}/press/${p.slug}`, lastmod: p.updatedAt });
  } catch (err) {
    console.error("[sitemap] pages query failed:", err);
  }
  return entries;
}

async function listingEntries(index: number): Promise<Entry[]> {
  try {
    const rows = await prisma.property.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { mlsNumber: true, updatedAt: true },
      orderBy: { mlsNumber: "asc" },
      skip: index * LISTINGS_PER_SITEMAP,
      take: LISTINGS_PER_SITEMAP,
    });
    return rows.map((r) => ({ loc: `${SITE_URL}/properties/${r.mlsNumber}`, lastmod: r.updatedAt }));
  } catch (err) {
    console.error("[sitemap] listings query failed:", err);
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const { name } = params;
  let entries: Entry[];
  if (name === "pages.xml") {
    entries = await pagesEntries();
  } else {
    const m = /^listings-(\d+)\.xml$/.exec(name);
    if (!m) return new Response("Not found", { status: 404 });
    entries = await listingEntries(Number(m[1]));
  }
  return new Response(urlsetXml(entries), { headers: XML_RESPONSE_HEADERS });
}
