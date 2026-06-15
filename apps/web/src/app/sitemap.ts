import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = "https://cncrealtygroup.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE}/properties`, lastModified: new Date(), priority: 0.9, changeFrequency: "hourly" },
    { url: `${BASE}/join`, lastModified: new Date(), priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/contact`, lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/about`, lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
  ];

  let propertyRoutes: MetadataRoute.Sitemap = [];
  let agentRoutes: MetadataRoute.Sitemap = [];

  try {
    const [properties, agents] = await Promise.all([
      prisma.property.findMany({
        select: { mlsNumber: true, updatedAt: true },
        where: { status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] } },
        orderBy: { updatedAt: "desc" },
        take: 50_000,
      }),
      prisma.agent.findMany({
        select: { slug: true, updatedAt: true },
      }),
    ]);

    propertyRoutes = properties.map((p) => ({
      url: `${BASE}/properties/${p.mlsNumber}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    agentRoutes = agents
      .filter((a) => a.slug)
      .map((a) => ({
        url: `${BASE}/agents/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (err) {
    console.error("[sitemap] DB error:", err);
  }

  return [...staticRoutes, ...agentRoutes, ...propertyRoutes];
}
