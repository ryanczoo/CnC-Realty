import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = "https://cncrealtygroup.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, agents] = await Promise.all([
    prisma.property.findMany({
      select: { mlsNumber: true, updatedAt: true },
      where: { status: { in: ["Active", "Coming Soon"] } },
      orderBy: { updatedAt: "desc" },
      take: 50_000,
    }),
    prisma.agent.findMany({
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE}/properties`, lastModified: new Date(), priority: 0.9, changeFrequency: "hourly" },
    { url: `${BASE}/join`, lastModified: new Date(), priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/contact`, lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/about`, lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${BASE}/properties/${p.mlsNumber}`,
    lastModified: p.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const agentRoutes: MetadataRoute.Sitemap = agents
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE}/agents/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticRoutes, ...agentRoutes, ...propertyRoutes];
}
