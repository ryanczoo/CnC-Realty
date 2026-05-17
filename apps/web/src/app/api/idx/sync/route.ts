import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";

export const maxDuration = 300;

async function runSync(type: string) {
  const modifiedSince = type === "full" ? undefined : new Date(Date.now() - 20 * 60 * 1000);

  let upserted = 0;
  let errors = 0;

  for await (const batch of fetchProperties(modifiedSince)) {
    await Promise.allSettled(
      batch.map(async (property) => {
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
      })
    );
  }

  return { upserted, errors, type };
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
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

// Manual POST trigger
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "delta";
  try {
    const result = await runSync(type);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
