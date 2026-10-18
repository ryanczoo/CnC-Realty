import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const pipeline = {
  hset: vi.fn(),
  expire: vi.fn(),
  rename: vi.fn(),
  exec: vi.fn().mockResolvedValue([]),
};
pipeline.hset.mockReturnValue(pipeline);
pipeline.expire.mockReturnValue(pipeline);
pipeline.rename.mockReturnValue(pipeline);

vi.mock("@/lib/redis", () => ({
  redis: {
    hmget: vi.fn(),
    setex: vi.fn().mockResolvedValue("OK"),
    multi: vi.fn(() => pipeline),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    property: { count: vi.fn() },
  },
}));

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { countCacheKey } from "@/lib/property-count-cache";
import { buildLocationWhere } from "@/lib/property-search-query";
import {
  CITY_COUNTS_KEY,
  COUNTS_TTL_SECONDS,
  RENT_CITY_QUERIES,
  presetSearches,
  refreshListingCounts,
  getCachedCityCount,
} from "@/lib/listing-counts";

// Exactly how app/(listings)/properties/page.tsx and app/api/properties/route.ts build the filter they count.
const pageWhere = (listingType: string, query?: string) => ({
  status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
  listingType,
  ...(query ? buildLocationWhere(query) : {}),
});

describe("presetSearches", () => {
  it("lands on the exact cache key the search page reads for the plain For Sale and For Rent searches", () => {
    const keys = presetSearches().map((s) => countCacheKey(s.where));
    expect(keys).toContain(countCacheKey(pageWhere("FOR_SALE")));
    expect(keys).toContain(countCacheKey(pageWhere("FOR_RENT")));
  });

  it("lands on the exact cache key of each Rent page city link", () => {
    const keys = presetSearches().map((s) => countCacheKey(s.where));
    for (const city of RENT_CITY_QUERIES) {
      expect(keys).toContain(countCacheKey(pageWhere("FOR_RENT", city)));
    }
  });

  it("covers exactly the cities the Rent page links to", () => {
    const src = readFileSync(
      path.join(__dirname, "../../components/rent/RentCitiesSlider.tsx"),
      "utf8",
    );
    const linked = Array.from(src.matchAll(/listingType=FOR_RENT&query=([^"]+)"/g)).map((m) =>
      decodeURIComponent(m[1].replace(/\+/g, " ")),
    );
    expect(linked.length).toBeGreaterThan(0);
    expect([...RENT_CITY_QUERIES].sort()).toEqual([...linked].sort());
  });
});

describe("refreshListingCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipeline.hset.mockReturnValue(pipeline);
    pipeline.expire.mockReturnValue(pipeline);
    pipeline.rename.mockReturnValue(pipeline);
    pipeline.exec.mockResolvedValue([]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { city: "los angeles", listingType: null, byListingType: 0, n: 21975 },
      { city: "cerritos", listingType: null, byListingType: 0, n: 147 },
      { city: null, listingType: null, byListingType: 0, n: 12 },
      { city: null, listingType: "FOR_SALE", byListingType: 1, n: 167832 },
      { city: null, listingType: "FOR_RENT", byListingType: 1, n: 49047 },
    ] as never);
    vi.mocked(prisma.property.count).mockResolvedValue(9033);
  });

  it("swaps in a fresh city count map in one step, so a reader never sees a half-written one", async () => {
    await refreshListingCounts();
    const [tmpKey, map] = pipeline.hset.mock.calls[0];
    expect(map).toEqual({ "los angeles": 21975, cerritos: 147, __ready: 1 });
    expect(pipeline.expire).toHaveBeenCalledWith(tmpKey, COUNTS_TTL_SECONDS);
    expect(pipeline.rename).toHaveBeenCalledWith(tmpKey, CITY_COUNTS_KEY);
    expect(pipeline.exec).toHaveBeenCalled();
  });

  it("saves the For Sale and For Rent totals from the same grouped query, under the search page's keys", async () => {
    await refreshListingCounts();
    expect(redis.setex).toHaveBeenCalledWith(countCacheKey(pageWhere("FOR_SALE")), COUNTS_TTL_SECONDS, 167832);
    expect(redis.setex).toHaveBeenCalledWith(countCacheKey(pageWhere("FOR_RENT")), COUNTS_TTL_SECONDS, 49047);
  });

  it("counts each Rent page city search with the same filter the search page uses", async () => {
    await refreshListingCounts();
    for (const city of RENT_CITY_QUERIES) {
      expect(prisma.property.count).toHaveBeenCalledWith({ where: pageWhere("FOR_RENT", city) });
      expect(redis.setex).toHaveBeenCalledWith(countCacheKey(pageWhere("FOR_RENT", city)), COUNTS_TTL_SECONDS, 9033);
    }
  });

  it("does not run the separate default-search counts again (they come from the grouped query)", async () => {
    await refreshListingCounts();
    expect(prisma.property.count).toHaveBeenCalledTimes(RENT_CITY_QUERIES.length);
  });

  it("saves a total of 0 when a listing type has no active listings", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { city: "los angeles", listingType: null, byListingType: 0, n: 5 },
      { city: null, listingType: "FOR_SALE", byListingType: 1, n: 5 },
    ] as never);
    await refreshListingCounts();
    expect(redis.setex).toHaveBeenCalledWith(countCacheKey(pageWhere("FOR_RENT")), COUNTS_TTL_SECONDS, 0);
  });
});

describe("getCachedCityCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.hmget).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the saved count, matching the city case-insensitively", async () => {
    vi.mocked(redis.hmget).mockResolvedValue({ cerritos: 147, __ready: 1 });
    expect(await getCachedCityCount("Cerritos")).toBe(147);
    expect(redis.hmget).toHaveBeenCalledWith(CITY_COUNTS_KEY, "cerritos", "__ready");
  });

  it("returns 0 for a city with no active listings when the saved map exists", async () => {
    vi.mocked(redis.hmget).mockResolvedValue({ "nowhere town": null, __ready: 1 });
    expect(await getCachedCityCount("Nowhere Town")).toBe(0);
  });

  it("returns null when no map has been saved yet, so the caller counts live", async () => {
    vi.mocked(redis.hmget).mockResolvedValue(null);
    expect(await getCachedCityCount("Cerritos")).toBeNull();
  });

  it("returns null when Redis errors", async () => {
    vi.mocked(redis.hmget).mockRejectedValue(new Error("redis down"));
    expect(await getCachedCityCount("Cerritos")).toBeNull();
  });

  it("waits through a slow first Redis connection (~500 ms) rather than falling back to a 5–10 s live count", async () => {
    vi.useFakeTimers();
    vi.mocked(redis.hmget).mockReturnValue(
      new Promise((resolve) => setTimeout(() => resolve({ cerritos: 147, __ready: 1 }), 600)) as never,
    );
    const result = getCachedCityCount("Cerritos");
    await vi.advanceTimersByTimeAsync(600);
    expect(await result).toBe(147);
  });

  it("returns null when Redis hangs, instead of holding up the page", async () => {
    vi.useFakeTimers();
    vi.mocked(redis.hmget).mockReturnValue(new Promise(() => {}) as never);
    const result = getCachedCityCount("Cerritos");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBeNull();
  });
});
