import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const searches = await prisma.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ searches });
  } catch (err) {
    console.error("[saved-searches GET] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body: {
    name?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    minBaths?: number;
    propertyType?: string;
    cities?: string[];
    zips?: string[];
    alertsOn?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const search = await prisma.savedSearch.create({
      data: {
        userId: session.user.id,
        name: body.name ?? null,
        minPrice: body.minPrice ?? null,
        maxPrice: body.maxPrice ?? null,
        minBeds: body.minBeds ?? null,
        minBaths: body.minBaths ?? null,
        propertyType: body.propertyType ?? null,
        cities: body.cities ?? [],
        zips: body.zips ?? [],
        alertsOn: body.alertsOn ?? true,
      },
    });
    return NextResponse.json({ search }, { status: 201 });
  } catch (err) {
    console.error("[saved-searches POST] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
