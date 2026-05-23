import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";

// maxDuration applies to GET (Vercel Cron, awaits full sync).
// POST returns 202 immediately — the background runSync() is not bound by this limit.
export const maxDuration = 300;

async function runSync(type: string) {
  const startedAt = Date.now();
  console.log(`[idx-sync] starting ${type} sync`);

  const modifiedSince = type === "full" ? undefined : new Date(Date.now() - 30 * 60 * 1000);

  let upserted = 0;
  let errors = 0;

  for await (const batch of fetchProperties(modifiedSince)) {
    for (const property of batch) {
      try {
        await prisma.property.upsert({
          where: { mlsNumber: property.mlsNumber },
          create: property,
          update: property,
        });
        upserted++;
      } catch (err) {
        console.error("Upsert failed for", property.mlsNumber, err);
        errors++;
      }
    }
  }

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
