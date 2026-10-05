import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue(undefined),
  },
}));

import { redis } from "@/lib/redis";
import { countCacheKey, cachedCount } from "@/lib/property-count-cache";

describe("countCacheKey", () => {
  it("is the same for the server page and every infinite-scroll page of one search", () => {
    const page = countCacheKey({ listingType: "FOR_SALE", query: "Pasadena", minBeds: "3" });
    const api1 = countCacheKey({ minBeds: "3", page: "1", limit: "20", query: "Pasadena", listingType: "FOR_SALE" });
    const api2 = countCacheKey({ query: "Pasadena", listingType: "FOR_SALE", minBeds: "3", page: "4" });
    expect(api1).toBe(page);
    expect(api2).toBe(page);
  });
  it("ignores empty filters and differs when a filter differs", () => {
    expect(countCacheKey({ listingType: "FOR_SALE", query: "", minPrice: undefined, maxPrice: null }))
      .toBe(countCacheKey({ listingType: "FOR_SALE" }));
    expect(countCacheKey({ listingType: "FOR_RENT" })).not.toBe(countCacheKey({ listingType: "FOR_SALE" }));
  });
});

describe("cachedCount", () => {
  beforeEach(() => vi.clearAllMocks());

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
