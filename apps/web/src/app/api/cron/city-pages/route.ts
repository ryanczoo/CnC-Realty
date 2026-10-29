import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { refreshCityPages } from "@/lib/city-pages";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily: saves the cities that get a /homes-for-sale/<city> page (lib/city-pages.ts).
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await refreshCityPages());
  } catch (err) {
    console.error("[city-pages] refresh failed:", err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}

export const GET = POST;
