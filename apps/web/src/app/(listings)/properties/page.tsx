import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SearchResults } from "@/components/properties/SearchResults";
import { PropertyListing } from "@/types/property";

export const metadata: Metadata = {
  title: "Property Search",
  description:
    "Search thousands of active CRMLS listings in Southern California.",
};

interface PageProps {
  searchParams: {
    query?: string;
    minPrice?: string;
    maxPrice?: string;
    minBeds?: string;
    minBaths?: string;
    propertyType?: string;
  };
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  const limit = 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    status: { in: ["Active", "Coming Soon"] },
  };

  if (searchParams.query) {
    if (/^\d{5}$/.test(searchParams.query)) {
      where.zip = searchParams.query;
    } else {
      where.city = { contains: searchParams.query, mode: "insensitive" };
    }
  }

  const priceFilter: Record<string, number> = {};
  if (searchParams.minPrice) priceFilter.gte = parseFloat(searchParams.minPrice);
  if (searchParams.maxPrice) priceFilter.lte = parseFloat(searchParams.maxPrice);
  if (Object.keys(priceFilter).length > 0) {
    where.listPrice = priceFilter;
  }

  if (searchParams.minBeds) where.beds = { gte: parseInt(searchParams.minBeds) };
  if (searchParams.minBaths) where.baths = { gte: parseFloat(searchParams.minBaths) };
  if (searchParams.propertyType) {
    where.propertyType = { contains: searchParams.propertyType, mode: "insensitive" };
  }

  const [rawProperties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { listedAt: "desc" },
      take: limit,
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
    prisma.property.count({ where }),
  ]);

  const initialProperties: PropertyListing[] = rawProperties.map((p) => ({
    ...p,
    photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
    listedAt: p.listedAt?.toISOString() ?? null,
  }));

  return (
    <SearchResults
      initialProperties={initialProperties}
      initialTotal={total}
    />
  );
}
