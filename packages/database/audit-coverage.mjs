import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const ENV_FILES = ["./.env", "../../apps/web/.env.local"];
function fromEnv(key) {
  for (const rel of ENV_FILES) {
    const p = new URL(rel, import.meta.url);
    if (!existsSync(p)) continue;
    const hit = readFileSync(p, "utf8").replace(/\r/g, "")
      .match(new RegExp(`^\\s*${key}\\s*=\\s*["']?(.+?)["']?\\s*$`, "m"))?.[1];
    if (hit) return hit;
  }
}
process.env.DATABASE_URL = fromEnv("DATABASE_URL");

const BASE = "https://api-trestle.corelogic.com/trestle/odata";
const STATUS = "StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')";

const tok = await (await fetch("https://api-trestle.corelogic.com/trestle/oidc/connect/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: fromEnv("CRMLS_CLIENT_ID"),
    client_secret: fromEnv("CRMLS_CLIENT_SECRET"),
    scope: "api",
  }).toString(),
})).json();

async function count(filter) {
  const url = `${BASE}/Property?$filter=${encodeURIComponent(filter)}&$top=1&$count=true&$select=ListingKey`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return Number((await r.json())["@odata.count"]);
}

const prisma = new PrismaClient();
const pad = (s, n) => String(s).padStart(n);
const fmt = (n) => n.toLocaleString();

try {
  console.log("year        Trestle       ourRows    coverage");
  console.log("-".repeat(48));
  let tSum = 0, oSum = 0;
  for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = `${y + 1}-01-01T00:00:00Z`;
    const remote = await count(`${STATUS} and ModificationTimestamp ge ${from} and ModificationTimestamp lt ${to}`);
    const local = await prisma.property.count({
      where: { modifiedAt: { gte: new Date(from), lt: new Date(to) } },
    });
    tSum += remote; oSum += local;
    console.log(`${y}   ${pad(fmt(remote), 11)}   ${pad(fmt(local), 11)}    ${pad(((local / remote) * 100).toFixed(1) + "%", 7)}`);
  }
  console.log("-".repeat(48));
  console.log(`sum    ${pad(fmt(tSum), 11)}   ${pad(fmt(oSum), 11)}    ${pad(((oSum / tSum) * 100).toFixed(1) + "%", 7)}`);

  const dbTotal = await prisma.property.count();
  const dbNoMod = await prisma.property.count({ where: { modifiedAt: null } });
  console.log(`\nDB total ${fmt(dbTotal)}  (rows with null modifiedAt: ${fmt(dbNoMod)})`);
  console.log(`Trestle total ${fmt(await count(STATUS))}`);
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await prisma.$disconnect();
}
