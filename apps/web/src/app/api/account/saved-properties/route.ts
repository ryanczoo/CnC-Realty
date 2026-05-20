import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const saved = await prisma.savedProperty.findMany({
    where: { userId: session.user.id },
    select: { mlsNumber: true },
  });

  if (saved.length === 0) return NextResponse.json({ properties: [] });

  const properties = await prisma.property.findMany({
    where: { mlsNumber: { in: saved.map((s) => s.mlsNumber) } },
    select: {
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
  });

  return NextResponse.json({ properties });
}
