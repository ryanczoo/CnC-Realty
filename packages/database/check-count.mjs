import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Rough size of the CRMLS result set for the full-sync filter
// (Active + ComingSoon + ActiveUnderContract + Closed). Estimate only.
const EST_TOTAL = 4_700_000;

const env = readFileSync(new URL("./.env", import.meta.url), "utf8").replace(/\r/g, "");
process.env.DATABASE_URL = env.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m)?.[1];

const prisma = new PrismaClient();
const STATE = new URL("./.check-count-last.json", import.meta.url);

const fmt = (n) => n.toLocaleString();

try {
  const now = Date.now();
  const total = await prisma.property.count();
  const cp = await prisma.syncProgress.findUnique({ where: { syncType: "full" } });

  const skip = cp ? Number(new URL(cp.nextLink).searchParams.get("$skip") ?? 0) : null;
  const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
  const mins = prev ? (now - prev.at) / 60000 : 0;

  console.log(`rows in DB      : ${fmt(total)}${prev ? `  (${total - prev.total >= 0 ? "+" : ""}${fmt(total - prev.total)} since last check)` : ""}`);

  if (skip === null) {
    console.log("crawl position  : no checkpoint - crawl finished, or not started");
  } else {
    const pct = ((skip / EST_TOTAL) * 100).toFixed(1);
    console.log(`crawl position  : $skip=${fmt(skip)} of ~${fmt(EST_TOTAL)} (~${pct}%)`);

    if (prev?.skip != null && mins > 0.2) {
      const rate = (skip - prev.skip) / mins;
      if (rate > 0) {
        const hrs = (EST_TOTAL - skip) / rate / 60;
        console.log(`crawl rate      : ~${fmt(Math.round(rate))} records/min  -> ETA ~${hrs.toFixed(1)}h`);
      } else {
        console.log(`crawl rate      : STALLED (no movement in ${mins.toFixed(1)}m)`);
      }
    } else if (prev) {
      console.log("crawl rate      : (check again in a few minutes)");
    }

    const age = Math.round((now - cp.updatedAt.getTime()) / 1000);
    console.log(`checkpoint      : written ${age}s ago${age > 300 ? "  <-- STALE, crawl may be hung" : ""}`);
  }

  writeFileSync(STATE, JSON.stringify({ total, skip, at: now }));
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await prisma.$disconnect();
}
