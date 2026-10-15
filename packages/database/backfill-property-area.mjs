// One-off, idempotent: copy details.MLSAreaMajor into Property.area in id order,
// 20k rows per statement so no long lock. Safe to re-run (only fills NULLs).
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const ENV_FILES = ["./.env", "../../apps/web/.env.local"];
function readEnv(key) {
  for (const rel of ENV_FILES) {
    const path = new URL(rel, import.meta.url);
    if (!existsSync(path)) continue;
    const hit = readFileSync(path, "utf8").replace(/\r/g, "")
      .match(new RegExp(`^\\s*${key}\\s*=\\s*["']?(.+?)["']?\\s*$`, "m"))?.[1];
    if (hit) return hit;
  }
}
process.env.DATABASE_URL = readEnv("DATABASE_URL");
const prisma = new PrismaClient();
const BATCH = 20000;
let after = "", filled = 0, batches = 0;
for (;;) {
  const [{ last }] = await prisma.$queryRawUnsafe(
    `SELECT max(id) AS last FROM (SELECT id FROM "Property" WHERE id > $1 ORDER BY id LIMIT ${BATCH}) b`, after);
  if (!last) break;
  filled += await prisma.$executeRawUnsafe(
    `UPDATE "Property" SET area = details->>'MLSAreaMajor'
     WHERE id > $1 AND id <= $2 AND area IS NULL AND details->>'MLSAreaMajor' IS NOT NULL`, after, last);
  after = last; batches++;
  if (batches % 20 === 0) console.log(`batch ${batches}, filled ${filled}`);
}
console.log(`done: ${batches} batches, filled ${filled}`);
await prisma.$disconnect();
