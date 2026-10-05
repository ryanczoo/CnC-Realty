import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue(undefined),
  },
}));

import { redis } from "@/lib/redis";
import { countCacheKey, cachedCount } from "@/lib/property-count-cache";

const base = { status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] }, listingType: "FOR_SALE" };

describe("countCacheKey", () => {
  it("is keyed by the filter actually counted, so equal filters share one key regardless of field order", () => {
    const a = countCacheKey({ ...base, beds: { gte: 3 }, listPrice: { gte: 500000 } });
    const b = countCacheKey({ listPrice: { gte: 500000 }, listingType: "FOR_SALE", beds: { gte: 3 }, status: base.status });
    expect(a).toBe(b);
  });
  it("can't be poisoned: a different filter never lands on the plain search's key", () => {
    const plain = countCacheKey(base);
    // e.g. ?minPrice=100000000&minPrice= counts listPrice >= 1e8 — must not share the plain key
    expect(countCacheKey({ ...base, listPrice: { gte: 100000000 } })).not.toBe(plain);
    // values containing & or = cannot forge another filter's key
    expect(countCacheKey({ ...base, city: { contains: "a&beds=3" } }))
      .not.toBe(countCacheKey({ ...base, city: { contains: "a" }, beds: 3 }));
  });
  it("distinguishes filter values, not just which filters are present", () => {
    expect(countCacheKey({ ...base, listPrice: { gte: 100000000 } })).not.toBe(countCacheKey({ ...base, listPrice: { gte: 500000 } }));
  });
  it("differs by listing type", () => {
    expect(countCacheKey({ ...base, listingType: "FOR_RENT" })).not.toBe(countCacheKey(base));
  });
});

describe("cachedCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockReset();
  });

  it("returns the cached count without touching the database", async () => {
    vi.mocked(redis.get).mockResolvedValue(160541);
    const compute = vi.fn();
    expect(await cachedCount("k", compute)).toBe(160541);
    expect(compute).not.toHaveBeenCalled();
  });

  it("counts on a miss and caches the result for 5 minutes", async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    const compute = vi.fn().mockResolvedValue(42);
    expect(await cachedCount("k", compute)).toBe(42);
    expect(redis.setex).toHaveBeenCalledWith("k", 300, 42);
  });

  it("still counts when Redis is down", async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error("redis down"));
    const compute = vi.fn().mockResolvedValue(7);
    expect(await cachedCount("k", compute)).toBe(7);
  });

  it("treats a cached 0 as a hit", async () => {
    vi.mocked(redis.get).mockResolvedValue(0);
    const compute = vi.fn();
    expect(await cachedCount("k", compute)).toBe(0);
    expect(compute).not.toHaveBeenCalled();
  });
});

describe("cachedCount — Redis hang", () => {
  it("stops waiting for a hung Redis after a short timeout and counts directly", async () => {
    vi.useFakeTimers();
    vi.mocked(redis.get).mockReturnValue(new Promise(() => {}) as never);
    const compute = vi.fn().mockResolvedValue(9);
    const p = cachedCount("k", compute);
    await vi.advanceTimersByTimeAsync(350);
    await expect(p).resolves.toBe(9);
    vi.useRealTimers();
  });
});
