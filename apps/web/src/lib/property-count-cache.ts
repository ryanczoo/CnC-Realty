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
// give it this long, then count from the database instead. A fresh server's first
// Redis read takes ~500 ms to connect, and giving up early means a 5–12 s recount
// that also overwrites the hourly saved total (lib/listing-counts.ts).
const REDIS_GET_TIMEOUT_MS = 1000;

// A Redis read that gives up (null) after REDIS_GET_TIMEOUT_MS or on an error.
export async function redisReadOrNull<T>(read: () => Promise<T | null>, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), REDIS_GET_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.error(`[${label}] redis read failed:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function cachedCount(key: string, compute: () => Promise<number>): Promise<number> {
  const hit = await redisReadOrNull(() => redis.get<number>(key), "property-count-cache");
  if (typeof hit === "number") return hit;
  const total = await compute();
  redis.setex(key, COUNT_TTL_SECONDS, total).catch(console.error);
  return total;
}
