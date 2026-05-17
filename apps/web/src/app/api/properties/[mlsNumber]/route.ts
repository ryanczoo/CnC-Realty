import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { mlsNumber: string } }
) {
  try {
    const property = await prisma.property.findUnique({
      where: { mlsNumber: params.mlsNumber },
    });

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(property);
  } catch (err) {
    console.error("[property-detail] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
