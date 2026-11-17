import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getBusy, BookingUnavailableError } from "@/lib/booking/busy";
import { openSlots, groupByPacificDate } from "@/lib/booking/slots";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const DAY_MS = 86_400_000;

export async function GET() {
  try {
    const now = new Date();
    const busy = await getBusy(now, new Date(now.getTime() + 15 * DAY_MS));
    const days = groupByPacificDate(openSlots(now, busy));
    return NextResponse.json({ status: "ok", days }, { headers: HEADERS });
  } catch (err) {
    if (!(err instanceof BookingUnavailableError)) {
      console.error("[booking/slots]", err);
      Sentry.captureException(err);
    }
    return NextResponse.json({ status: "unavailable" }, { headers: HEADERS });
  }
}
