import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Fix 1: NaN-safe numeric parsing
  const parsedPage = parseInt(searchParams.get("page") ?? "1");
  const parsedLimit = parseInt(searchParams.get("limit") ?? "20");
  const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
  const limit = Math.max(1, Math.min(50, Number.isNaN(parsedLimit) ? 20 : parsedLimit));

  const rawMinPrice = searchParams.get("minPrice");
  const rawMaxPrice = searchParams.get("maxPrice");
  const rawMinBeds = searchParams.get("minBeds");
  const rawMinBaths = searchParams.get("minBaths");

  const minPriceVal = rawMinPrice ? parseFloat(rawMinPrice) : null;
  const maxPriceVal = rawMaxPrice ? parseFloat(rawMaxPrice) : null;
  const minBedsVal = rawMinBeds ? parseInt(rawMinBeds) : null;
  const minBathsVal = rawMinBaths ? parseFloat(rawMinBaths) : null;

  const city = searchParams.get("city");
  const zip = searchParams.get("zip");
  const propertyType = searchParams.get("propertyType");

  const where: Prisma.PropertyWhereInput = {
    status: { in: ["Active", "Coming Soon"] },
  };

  if (city) where.city = { contains: city, mode: "insensitive" };
  if (zip) where.zip = zip;

  // Fix 2: Typed listPrice filter (no as object cast)
  const priceFilter: Prisma.FloatFilter = {};
  if (minPriceVal !== null && !Number.isNaN(minPriceVal)) priceFilter.gte = minPriceVal;
  if (maxPriceVal !== null && !Number.isNaN(maxPriceVal)) priceFilter.lte = maxPriceVal;
  if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) where.listPrice = priceFilter;

  // Fix 4: Beds/baths filter NaN guard
  if (minBedsVal !== null && !Number.isNaN(minBedsVal)) where.beds = { gte: minBedsVal };
  if (minBathsVal !== null && !Number.isNaN(minBathsVal)) where.baths = { gte: minBathsVal };

  if (propertyType) where.propertyType = { contains: propertyType, mode: "insensitive" };

  // Fix 3: Wrap DB query in try/catch
  try {
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
  } catch (err) {
    console.error("[properties] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
