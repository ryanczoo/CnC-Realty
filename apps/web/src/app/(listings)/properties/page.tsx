import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SearchResults } from "@/components/properties/SearchResults";
import { PropertyListing, MULTIFAMILY_TYPES, COMMERCIAL_TYPES } from "@/types/property";
import { buildLocationWhere } from "@/lib/property-search-query";

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
    status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
    listingType,
  };

  if (searchParams.query?.trim()) {
    Object.assign(where, buildLocationWhere(searchParams.query.trim()));
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
  if (searchParams.propertyType === "MultiFamily") {
    where.propertyType = { in: [...MULTIFAMILY_TYPES] };
  } else if (searchParams.propertyType === "Commercial") {
    where.propertyType = { in: [...COMMERCIAL_TYPES] };
  } else if (searchParams.propertyType) {
    where.propertyType = { contains: searchParams.propertyType, mode: "insensitive" };
  }

  try {
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
  } catch {
    return (
      <div data-navbar-theme="light" className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
        <div className="text-center">
          <p className="text-lg font-light text-[#1B1B1B]">Unable to load listings right now.</p>
          <p className="mt-2 text-sm text-[#1B1B1B]/50">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

}
