import { prisma } from "@/lib/prisma";
import { PropertyListing, MULTIFAMILY_TYPES, COMMERCIAL_TYPES } from "@/types/property";
import { buildLocationWhere } from "@/lib/property-search-query";
import { cachedCount, countCacheKey } from "@/lib/property-count-cache";

// The first page of results the Search page (/properties) and the city pages (/homes-for-sale/<city>) render on the
// server. Later pages and filter changes go through /api/properties from the browser.

export interface SearchPageParams {
  query?: string;
  listingType?: string;
  minPrice?: string;
  maxPrice?: string;
  minBeds?: string;
  minBaths?: string;
  propertyType?: string;
}

export const SEARCH_PAGE_SIZE = 20;

export function searchPageWhere(params: SearchPageParams): Record<string, unknown> {
  const where: Record<string, unknown> = {
    status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
    listingType: params.listingType ?? "FOR_SALE",
  };

  if (params.query?.trim()) {
    Object.assign(where, buildLocationWhere(params.query.trim()));
  }

  const priceFilter: Record<string, number> = {};
  const minPrice = parseFloat(params.minPrice ?? "");
  const maxPrice = parseFloat(params.maxPrice ?? "");
  if (!Number.isNaN(minPrice)) priceFilter.gte = minPrice;
  if (!Number.isNaN(maxPrice)) priceFilter.lte = maxPrice;
  if (Object.keys(priceFilter).length > 0) where.listPrice = priceFilter;

  const minBeds = parseInt(params.minBeds ?? "");
  const minBaths = parseFloat(params.minBaths ?? "");
  if (!Number.isNaN(minBeds)) where.beds = { gte: minBeds };
  if (!Number.isNaN(minBaths)) where.baths = { gte: minBaths };
  if (params.propertyType === "MultiFamily") {
    where.propertyType = { in: [...MULTIFAMILY_TYPES] };
  } else if (params.propertyType === "Commercial") {
    where.propertyType = { in: [...COMMERCIAL_TYPES] };
  } else if (params.propertyType) {
    where.propertyType = { contains: params.propertyType, mode: "insensitive" };
  }
  return where;
}

export async function loadSearchPage(params: SearchPageParams): Promise<{ properties: PropertyListing[]; total: number }> {
  const where = searchPageWhere(params);
  const [rawProperties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { listedAt: "desc" },
      take: SEARCH_PAGE_SIZE,
      select: {
        id: true,
        mlsNumber: true,
        status: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        propertyType: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        latitude: true,
        longitude: true,
        photos: true,
        listedAt: true,
      },
    }),
    cachedCount(countCacheKey(where), () => prisma.property.count({ where })),
  ]);

  const properties: PropertyListing[] = rawProperties.map((p) => ({
    ...p,
    photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
    listedAt: p.listedAt?.toISOString() ?? null,
  }));
  return { properties, total };
}
