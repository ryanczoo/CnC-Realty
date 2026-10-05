import { redis } from "@/lib/redis";

// Counting matching listings is the slow half of a search (it reads every
// match, not just one page). Cache it for 5 minutes, keyed by the exact
// database filter being counted — never by raw URL params, which can repeat
// or contain "&"/"=" and so map different searches onto one key. The server-
// rendered /properties page and every infinite-scroll page of the same search
// build the same filter, so they share one count.
const COUNT_TTL_SECONDS = 300;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function countCacheKey(where: unknown): string {
  return `properties:count:${stableStringify(where)}`;
}

// A hung Redis (as opposed to an erroring one) must not hold up the search page:
// give it this long, then count from the database instead.
const REDIS_GET_TIMEOUT_MS = 300;

export async function cachedCount(key: string, compute: () => Promise<number>): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const hit = await Promise.race([
      redis.get<number>(key),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), REDIS_GET_TIMEOUT_MS);
      }),
    ]);
    if (typeof hit === "number") return hit;
  } catch (err) {
    console.error("[property-count-cache] redis get failed:", err);
  } finally {
    clearTimeout(timer);
  }
  const total = await compute();
  redis.setex(key, COUNT_TTL_SECONDS, total).catch(console.error);
  return total;
}
