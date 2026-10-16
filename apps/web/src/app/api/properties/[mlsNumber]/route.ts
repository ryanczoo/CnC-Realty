import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdxLastSyncAt } from "@/lib/idx/last-sync";

export async function GET(
  _req: Request,
  { params }: { params: { mlsNumber: string } }
) {
  try {
    const [property, lastSyncAt] = await Promise.all([
      prisma.property.findUnique({ where: { mlsNumber: params.mlsNumber } }),
      getIdxLastSyncAt(),
    ]);

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ...property, lastSyncAt });
  } catch (err) {
    console.error("[property-detail] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
