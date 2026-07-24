import { prisma } from "@/lib/prisma";

export interface FeaturedListing {
  mlsNumber?: string;
  listPrice?: number;
  price?: string;
  beds: number | null;
  baths: number | null;
  sqft: number | string | null;
  address: string;
  city: string;
  status: string;
  photos?: string[];
  image?: string;
}

export const PLACEHOLDER_LISTINGS: FeaturedListing[] = [
  { price: "$1,250,000", beds: 4, baths: 3, sqft: "2,450", address: "1847 Oak Glen Dr", city: "Pasadena, CA", status: "For Sale", image: "https://picsum.photos/seed/house1/600/400" },
  { price: "$875,000", beds: 3, baths: 2, sqft: "1,820", address: "534 Magnolia Ave", city: "Glendale, CA", status: "For Sale", image: "https://picsum.photos/seed/house2/600/400" },
  { price: "$2,100,000", beds: 5, baths: 4, sqft: "4,100", address: "291 Wistaria Ave", city: "Arcadia, CA", status: "Open House", image: "https://picsum.photos/seed/house3/600/400" },
  { price: "$649,000", beds: 2, baths: 2, sqft: "1,210", address: "88 Olive St #4B", city: "Burbank, CA", status: "For Sale", image: "https://picsum.photos/seed/house4/600/400" },
  { price: "$1,050,000", beds: 3, baths: 3, sqft: "2,180", address: "702 Huntington Dr", city: "San Marino, CA", status: "For Sale", image: "https://picsum.photos/seed/house5/600/400" },
  { price: "$895,000", beds: 4, baths: 2, sqft: "1,960", address: "1103 Foothill Blvd", city: "Monrovia, CA", status: "Open House", image: "https://picsum.photos/seed/house6/600/400" },
  { price: "$1,495,000", beds: 4, baths: 3, sqft: "3,020", address: "445 Sierra Madre Blvd", city: "Sierra Madre, CA", status: "For Sale", image: "https://picsum.photos/seed/house7/600/400" },
  { price: "$735,000", beds: 3, baths: 2, sqft: "1,540", address: "2210 Rosemead Blvd", city: "Temple City, CA", status: "For Sale", image: "https://picsum.photos/seed/house8/600/400" },
];

export async function getFeaturedListings(): Promise<FeaturedListing[]> {
  try {
    const raw = await prisma.property.findMany({
      where: { status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] } },
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

    return raw.map((p) => ({
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
    return [];
  }
}
