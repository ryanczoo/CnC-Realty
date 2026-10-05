import { redis } from "@/lib/redis";

// Counting matching listings is the slow half of a search (it reads every
// match, not just one page). Cache it for 5 minutes, keyed by the filters only
// (never page/limit), so the server-rendered /properties page and every
// infinite-scroll page of the same search share one count.
const COUNT_TTL_SECONDS = 300;
const NON_FILTER_PARAMS = new Set(["page", "limit"]);

export function countCacheKey(params: Record<string, string | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([k, v]) => !NON_FILTER_PARAMS.has(k) && v != null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `properties:count:${parts.join("&") || "default"}`;
}

export async function cachedCount(key: string, compute: () => Promise<number>): Promise<number> {
  try {
    const hit = await redis.get<number>(key);
    if (typeof hit === "number") return hit;
  } catch (err) {
    console.error("[property-count-cache] redis get failed:", err);
  }
  const total = await compute();
  redis.setex(key, COUNT_TTL_SECONDS, total).catch(console.error);
  return total;
}
