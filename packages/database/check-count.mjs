import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Size of the CRMLS feed for the full-sync filter, from Trestle's own $count.
const TOTAL_RECORDS = 4_862_377;

// Secrets live in packages/database/.env on some machines and only in
// apps/web/.env.local on others (e.g. a box set up just to run the sync).
const ENV_FILES = ["./.env", "../../apps/web/.env.local"];

function readEnv(key) {
  for (const rel of ENV_FILES) {
    const path = new URL(rel, import.meta.url);
    if (!existsSync(path)) continue;
    const hit = readFileSync(path, "utf8")
      .replace(/\r/g, "")
      .match(new RegExp(`^\\s*${key}\\s*=\\s*["']?(.+?)["']?\\s*$`, "m"))?.[1];
    if (hit) return hit;
  }
  return undefined;
}

process.env.DATABASE_URL = readEnv("DATABASE_URL");
if (!process.env.DATABASE_URL) {
  console.error(`No DATABASE_URL found. Looked in: ${ENV_FILES.join(", ")}`);
  process.exit(1);
}

// How many feed records sit at or below a key — i.e. how much of the crawl is
// actually done. Best-effort: returns null rather than failing the status check.
async function recordsUpTo(key) {
  try {
    const id = readEnv("CRMLS_CLIENT_ID");
    const secret = readEnv("CRMLS_CLIENT_SECRET");
    if (!id || !secret) return null;
    const tok = await (
      await fetch("https://api-trestle.corelogic.com/trestle/oidc/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "api",
        }).toString(),
      })
    ).json();
    const filter =
      "StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')" +
      ` and ListingKeyNumeric le ${key}`;
    const res = await fetch(
      `https://api-trestle.corelogic.com/trestle/odata/Property?$filter=${encodeURIComponent(filter)}&$top=1&$count=true&$select=ListingKey`,
      { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" } }
    );
    if (!res.ok) return null;
    return Number((await res.json())["@odata.count"]);
  } catch {
    return null;
  }
}

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
  const rowDelta = prev ? total - prev.total : null;

  // Row count is cumulative across every crawl ever run, and its ceiling is
  // below the feed total because closed rentals are skipped. It says how much
  // data you hold - not how far along this crawl is.
  console.log(
    `rows in DB      : ${fmt(total)}` +
      (rowDelta === null
        ? ""
        : `  (${rowDelta >= 0 ? "+" : ""}${fmt(rowDelta)} since last check` +
          (mins > 0.2 ? `, ~${fmt(Math.round(rowDelta / mins))}/min` : "") + ")")
  );

  let done = null;

  if (!cp) {
    console.log("crawl           : no checkpoint - FINISHED, or not started");
  } else if (cursorKey === null) {
    console.log(`crawl           : stale pre-keyset checkpoint (${String(raw).slice(0, 60)})`);
    console.log("                  harmless - the new crawl ignores it and starts fresh");
  } else {
    done = await recordsUpTo(cursorKey);
    console.log(
      done === null
        ? "crawl progress  : (could not reach Trestle to measure)"
        : `crawl progress  : ${((done / TOTAL_RECORDS) * 100).toFixed(2)}%  - ${fmt(done)} of ${fmt(TOTAL_RECORDS)} records passed`
    );
    console.log(`crawl cursor    : ListingKeyNumeric ${fmt(cursorKey)}`);

    if (prev?.done != null && done != null && mins > 0.2) {
      const perMin = (done - prev.done) / mins;
      if (perMin > 0) {
        console.log(
          `crawl rate      : ~${fmt(Math.round(perMin))} records/min  -> ETA ~${((TOTAL_RECORDS - done) / perMin / 60).toFixed(1)}h`
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

  writeFileSync(STATE, JSON.stringify({ total, cursorKey, done, at: now }));
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await prisma.$disconnect();
}
