import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { refreshListingCounts } from "@/lib/listing-counts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Hourly: re-counts active listings per city and for the searches the site links to (lib/listing-counts.ts).
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const saved = await refreshListingCounts();
    return NextResponse.json(saved);
  } catch (err) {
    console.error("[listing-counts] refresh failed:", err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}

export const GET = POST;
