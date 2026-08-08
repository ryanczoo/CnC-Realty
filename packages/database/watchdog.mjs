// Restarts the IDX crawl if it dies.
//
// The crawl is an in-memory loop inside next-server. A transient failure the
// page-level retry can't absorb (a DNS blip, a long network drop) ends it, and
// nothing notices until someone looks. Over an unattended multi-hour run that
// silently costs hours.
//
// This polls the SyncProgress checkpoint. The crawl rewrites it every page
// (~seconds), so a checkpoint that stops advancing means the crawl is gone —
// and re-POSTing resumes from that same cursor, losing only the current page.
//
// Run it in its own window:  node watchdog.mjs
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const STALE_MS = 5 * 60_000; // checkpoint older than this => crawl is dead
const POLL_MS = 60_000;
const COOLDOWN_MS = 5 * 60_000; // never re-trigger faster than this
const SYNC_URL = "http://localhost:3000/api/idx/sync?type=full";

const ENV_FILES = ["./.env", "../../apps/web/.env.local"];
function fromEnv(key) {
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

process.env.DATABASE_URL = fromEnv("DATABASE_URL");
const secret = fromEnv("CRON_SECRET");
if (!process.env.DATABASE_URL || !secret) {
  console.error("Could not read DATABASE_URL / CRON_SECRET from .env files");
  process.exit(1);
}

const prisma = new PrismaClient();
const stamp = () => new Date().toLocaleTimeString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastTrigger = 0;
console.log(`[${stamp()}] watchdog started - polling every ${POLL_MS / 1000}s, restart if checkpoint older than ${STALE_MS / 60000}m`);

for (;;) {
  try {
    const cp = await prisma.syncProgress.findUnique({ where: { syncType: "full" } });

    if (!cp) {
      // Checkpoint is deleted only when a crawl runs to completion.
      console.log(`[${stamp()}] no checkpoint - crawl finished (or not started). Doing nothing.`);
    } else {
      const ageMs = Date.now() - cp.updatedAt.getTime();
      if (ageMs < STALE_MS) {
        console.log(`[${stamp()}] alive - checkpoint ${Math.round(ageMs / 1000)}s old (cursor ${cp.nextLink.slice(0, 16)})`);
      } else if (Date.now() - lastTrigger < COOLDOWN_MS) {
        console.log(`[${stamp()}] stale but within cooldown, waiting`);
      } else {
        console.log(`[${stamp()}] STALE ${Math.round(ageMs / 60000)}m - restarting crawl`);
        lastTrigger = Date.now();
        try {
          const res = await fetch(SYNC_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}` },
          });
          console.log(`[${stamp()}] restart POST -> ${res.status} ${res.ok ? "(resumed)" : await res.text()}`);
        } catch (err) {
          console.log(`[${stamp()}] restart POST failed: ${err.message} - is next-server still running in window 1?`);
        }
      }
    }
  } catch (err) {
    console.log(`[${stamp()}] check failed: ${err.message}`);
  }

  await sleep(POLL_MS);
}
