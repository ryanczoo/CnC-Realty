import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object, listR2Objects } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PREFIX = "wizard-photos/";
// A wizard is long finished after 2 days; anything no file uses by then is abandoned.
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

// Nightly: deletes wizard photos (and stuck raw uploads) that are over 2 days
// old and that no listing or transaction file uses. Runs off to the side, so
// no visitor-facing page pays for it.
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const where = { photoKey: { startsWith: PREFIX } };
    const [objects, listings, transactions] = await Promise.all([
      listR2Objects(PREFIX),
      prisma.listingFile.findMany({ where, select: { photoKey: true } }),
      prisma.transactionFile.findMany({ where, select: { photoKey: true } }),
    ]);
    const used = new Set([...listings, ...transactions].map((f) => f.photoKey));
    const cutoff = Date.now() - MAX_AGE_MS;
    const stale = objects.filter((o) => o.lastModified.getTime() < cutoff && !used.has(o.key));
    for (const o of stale) await deleteR2Object(o.key);
    return NextResponse.json({ deleted: stale.length });
  } catch (err) {
    console.error("[wizard-photo-cleanup] failed:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

export const GET = POST;
