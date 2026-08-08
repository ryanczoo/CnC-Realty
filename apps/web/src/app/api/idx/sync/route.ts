import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@cnc/database";
import { fetchProperties } from "@/lib/idx/client";

// maxDuration applies to GET (Vercel Cron, awaits full sync).
// POST returns 202 immediately — the background runSync() is not bound by this limit.
export const maxDuration = 300;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function isOldClosedSale(property: { status: string; closeDate: Date | null }): boolean {
  if (property.status !== "Closed" || !property.closeDate) return false;
  return Date.now() - property.closeDate.getTime() > ONE_YEAR_MS;
}

async function runSync(type: string) {
  const startedAt = Date.now();
  console.log(`[idx-sync] starting ${type} sync`);

  const modifiedSince = type === "full" ? undefined : new Date(Date.now() - 30 * 60 * 1000);

  // SyncProgress.nextLink holds a ModificationTimestamp cursor, not a URL — the
  // crawl pages by keyset now (see lib/idx/client.ts). The column kept its old
  // name to avoid a migration mid-resync; rename it once the crawl is done.
  const checkpoint = await prisma.syncProgress.findUnique({ where: { syncType: type } });
  if (checkpoint) {
    console.log(`[idx-sync] resuming ${type} sync from cursor ${checkpoint.nextLink}`);
  }

  let upserted = 0;
  let errors = 0;

  for await (const { properties: batch, cursor } of fetchProperties(modifiedSince, checkpoint?.nextLink)) {
    for (const property of batch) {
      if (property.status === "Closed" && property.listingType === "FOR_RENT") continue;
      const payload = isOldClosedSale(property)
        ? { ...property, photos: [], details: Prisma.DbNull }
        : property;
      try {
        await prisma.property.upsert({
          where: { mlsNumber: payload.mlsNumber },
          create: payload,
          update: payload,
        });
        upserted++;
      } catch (err) {
        console.error("Upsert failed for", property.mlsNumber, err);
        errors++;
      }
    }

    await prisma.syncProgress.upsert({
      where: { syncType: type },
      create: { syncType: type, nextLink: cursor },
      update: { nextLink: cursor },
    });
  }

  // Reaching here means the generator ran to completion — the crawl is finished,
  // so drop the checkpoint. If it threw instead, the checkpoint is deliberately
  // left in place so the next run resumes rather than restarting.
  await prisma.syncProgress.deleteMany({ where: { syncType: type } });

  console.log(`[idx-sync] done in ${Date.now() - startedAt}ms — upserted: ${upserted}, errors: ${errors}`);
  return { upserted, errors, type };
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Vercel Cron calls GET
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "delta";
  try {
    const result = await runSync(type);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Manual POST trigger — returns 202 immediately; sync runs in background
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "delta";
  runSync(type).catch(console.error);
  return NextResponse.json({ status: "started", type }, { status: 202 });
}
