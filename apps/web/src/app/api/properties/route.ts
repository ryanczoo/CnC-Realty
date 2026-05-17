import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const zip = searchParams.get("zip");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const minBeds = searchParams.get("minBeds");
  const minBaths = searchParams.get("minBaths");
  const propertyType = searchParams.get("propertyType");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

  const where: Prisma.PropertyWhereInput = {
    status: { in: ["Active", "Coming Soon"] },
  };

  if (city) where.city = { contains: city, mode: "insensitive" };
  if (zip) where.zip = zip;
  if (minPrice) where.listPrice = { ...where.listPrice as object, gte: parseFloat(minPrice) };
  if (maxPrice) where.listPrice = { ...where.listPrice as object, lte: parseFloat(maxPrice) };
  if (minBeds) where.beds = { gte: parseInt(minBeds) };
  if (minBaths) where.baths = { gte: parseFloat(minBaths) };
  if (propertyType) where.propertyType = { contains: propertyType, mode: "insensitive" };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { listedAt: "desc" },
      skip: (page - 1) * limit,
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

  return NextResponse.json({
    properties,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
