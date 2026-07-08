import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeEstimate,
  findComps,
  findSubjectProperty,
  getMarketSnapshot,
} from "@/lib/home-value-estimate";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const zip = searchParams.get("zip");

  if (!address || !zip) {
    return NextResponse.json({ error: "address and zip are required" }, { status: 400 });
  }

  const manualBeds = searchParams.get("beds") ? Number(searchParams.get("beds")) : null;
  const manualBaths = searchParams.get("baths") ? Number(searchParams.get("baths")) : null;
  const manualSqft = searchParams.get("sqft") ? Number(searchParams.get("sqft")) : null;
  const manualLotSize = searchParams.get("lotSize") ? Number(searchParams.get("lotSize")) : null;

  try {
    const matches = await findSubjectProperty(prisma, address, zip);
    const latest = matches[0] ?? null;

    const beds = latest?.beds ?? manualBeds;
    const baths = latest?.baths ?? manualBaths;
    const sqft = latest?.sqft ?? manualSqft;
    const lotSize = latest?.lotSize ?? manualLotSize;

    if (sqft == null) {
      return NextResponse.json({
        subject: null,
        needsManualEntry: true,
        priceHistory: [],
        comps: [],
        range: null,
        marketSnapshot: [],
      });
    }

    const [comps, marketSnapshot] = await Promise.all([
      findComps(prisma, { zip, beds, excludeMlsNumber: latest?.mlsNumber }),
      getMarketSnapshot(prisma, zip),
    ]);

    const estimate = computeEstimate(
      comps.map((c) => ({ closePrice: c.closePrice, sqft: c.sqft ?? 0 })),
      sqft
    );

    return NextResponse.json({
      subject: { beds, baths, sqft, lotSize, matched: matches.length > 0 },
      needsManualEntry: false,
      priceHistory: matches.map((m) => ({
        mlsNumber: m.mlsNumber,
        status: m.status,
        listPrice: m.listPrice,
        closePrice: m.closePrice,
        closeDate: m.closeDate ? m.closeDate.toISOString() : null,
        listedAt: m.listedAt ? m.listedAt.toISOString() : null,
      })),
      comps: comps.map((c) => ({ ...c, closeDate: c.closeDate.toISOString() })),
      range: estimate ? { low: estimate.rangeLow, high: estimate.rangeHigh, compCount: estimate.compCount } : null,
      marketSnapshot,
    });
  } catch (err) {
    console.error("[home-value/estimate] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
