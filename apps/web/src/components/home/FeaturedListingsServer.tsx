import { prisma } from "@/lib/prisma";
import { FeaturedListings } from "./FeaturedListings";

export async function FeaturedListingsServer() {
  let listings: Parameters<typeof FeaturedListings>[0]["listings"] = [];

  try {
    const raw = await prisma.property.findMany({
      where: { status: { in: ["Active", "Coming Soon"] } },
      orderBy: { listedAt: "desc" },
      take: 8,
      select: {
        mlsNumber: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        address: true,
        city: true,
        status: true,
        photos: true,
      },
    });

    listings = raw.map((p) => ({
      mlsNumber: p.mlsNumber,
      listPrice: p.listPrice,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      address: p.address,
      city: p.city,
      status: p.status,
      photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
    }));
  } catch {
    // Falls back to placeholder data in FeaturedListings
  }

  return <FeaturedListings listings={listings} />;
}
