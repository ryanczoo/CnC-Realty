import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// The crawl walks ModificationTimestamp ascending from the oldest record
// Trestle exposes. Progress is "how far through that time range are we".
const FEED_START = Date.parse("2021-04-30T00:00:00Z");
const TOTAL_RECORDS = 4_862_377;

// DATABASE_URL lives in packages/database/.env on some machines and only in
// apps/web/.env.local on others (e.g. a box set up just to run the sync).
const ENV_FILES = ["./.env", "../../apps/web/.env.local"];

function findDatabaseUrl() {
  const tried = [];
  for (const rel of ENV_FILES) {
    const path = new URL(rel, import.meta.url);
    tried.push(path.pathname);
    if (!existsSync(path)) continue;
    const url = readFileSync(path, "utf8")
      .replace(/\r/g, "")
      .match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m)?.[1];
    if (url) return url;
  }
  throw new Error(`No DATABASE_URL found. Looked in:\n  ${tried.join("\n  ")}`);
}

process.env.DATABASE_URL = findDatabaseUrl();

const prisma = new PrismaClient();
const STATE = new URL("./.check-count-last.json", import.meta.url);
const fmt = (n) => n.toLocaleString();

try {
  const now = Date.now();
  const total = await prisma.property.count();
  const cp = await prisma.syncProgress.findUnique({ where: { syncType: "full" } });

  // The cursor is a ListingKeyNumeric (a bare integer). Anything else is a
  // checkpoint from an older pagination scheme and gets discarded by the crawl.
  const raw = cp?.nextLink;
  const cursorKey = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
  const mins = prev ? (now - prev.at) / 60000 : 0;

  const delta = prev ? total - prev.total : null;
  console.log(
    `rows in DB      : ${fmt(total)}` +
      (delta === null ? "" : `  (${delta >= 0 ? "+" : ""}${fmt(delta)} since last check` +
        (mins > 0.2 ? `, ~${fmt(Math.round(delta / mins))}/min` : "") + ")")
  );

  if (!cp) {
    console.log("crawl           : no checkpoint - FINISHED, or not started");
  } else if (cursorKey === null) {
    console.log(`crawl           : stale pre-keyset checkpoint (${String(raw).slice(0, 60)})`);
    console.log("                  harmless - the new crawl ignores it and starts fresh");
  } else {
    // Progress is measured in rows, not cursor date: records are far denser in
    // some periods than others, so cursor-date position says little about how
    // much of the feed is left.
    console.log(
      `progress        : ${((total / TOTAL_RECORDS) * 100).toFixed(1)}% of ${fmt(TOTAL_RECORDS)} feed records`
    );
    console.log(`crawl cursor    : ListingKeyNumeric ${fmt(cursorKey)}`);

    if (prev?.cursorKey != null && mins > 0.2) {
      if (cursorKey > prev.cursorKey) {
        const perMin = delta / mins;
        const eta = perMin > 0 ? (TOTAL_RECORDS - total) / perMin / 60 : null;
        console.log(
          `crawl rate      : ~${fmt(Math.round(perMin))} rows/min` +
            (eta ? `  -> ETA ~${eta.toFixed(1)}h` : "  (rows flat - crawling records already stored)")
        );
      } else {
        console.log(`crawl rate      : STALLED (cursor has not moved in ${mins.toFixed(1)}m)`);
      }
    } else if (prev) {
      console.log("crawl rate      : (check again in a few minutes)");
    }

    const age = Math.round((now - cp.updatedAt.getTime()) / 1000);
    console.log(`checkpoint      : written ${age}s ago${age > 300 ? "  <-- STALE, crawl may be hung" : ""}`);
  }

  if (total > TOTAL_RECORDS * 0.98) {
    console.log(`\nnote: row count is near the feed total (${fmt(TOTAL_RECORDS)}) - likely near done`);
  }

  writeFileSync(STATE, JSON.stringify({ total, cursorKey, at: now }));
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await prisma.$disconnect();
}
