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
    listingType?: string;
    minPrice?: string;
    maxPrice?: string;
    minBeds?: string;
    minBaths?: string;
    propertyType?: string;
  };
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  const limit = 20;
  const listingType = searchParams.listingType ?? "FOR_SALE";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    status: { in: ["Active", "Coming Soon"] },
    listingType,
  };

  if (searchParams.query) {
    if (/^\d{5}$/.test(searchParams.query)) {
      where.zip = searchParams.query;
    } else {
      where.city = { contains: searchParams.query, mode: "insensitive" };
    }
  }

  const priceFilter: Record<string, number> = {};
  const minPrice = parseFloat(searchParams.minPrice ?? "");
  const maxPrice = parseFloat(searchParams.maxPrice ?? "");
  if (!Number.isNaN(minPrice)) priceFilter.gte = minPrice;
  if (!Number.isNaN(maxPrice)) priceFilter.lte = maxPrice;
  if (Object.keys(priceFilter).length > 0) where.listPrice = priceFilter;

  const minBeds = parseInt(searchParams.minBeds ?? "");
  const minBaths = parseFloat(searchParams.minBaths ?? "");
  if (!Number.isNaN(minBeds)) where.beds = { gte: minBeds };
  if (!Number.isNaN(minBaths)) where.baths = { gte: minBaths };
  if (searchParams.propertyType) {
    where.propertyType = { contains: searchParams.propertyType, mode: "insensitive" };
  }

  let rawProperties: Awaited<ReturnType<typeof prisma.property.findMany>> = [];
  let total = 0;
  let dbError = false;

  try {
    [rawProperties, total] = await Promise.all([
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
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
        <div className="text-center">
          <p className="text-lg font-light text-[#1B1B1B]">Unable to load listings right now.</p>
          <p className="mt-2 text-sm text-[#1B1B1B]/50">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

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
