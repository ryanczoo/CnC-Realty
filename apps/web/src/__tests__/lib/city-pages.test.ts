import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn().mockResolvedValue("OK") },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {
  CITY_PAGES_KEY,
  citySlug,
  nearbyCities,
  refreshCityPages,
  getCityPages,
  cityPageMeta,
  type CityPage,
} from "@/lib/city-pages";

const city = (name: string, lat: number, lng: number): CityPage => ({
  slug: citySlug(name), name, county: "Los Angeles", count: 30, lat, lng,
});

beforeEach(() => vi.clearAllMocks());

describe("citySlug", () => {
  it("lowercases, strips accents and joins words with dashes", () => {
    expect(citySlug("La Cañada Flintridge")).toBe("la-canada-flintridge");
    expect(citySlug("St. Helena")).toBe("st-helena");
    expect(citySlug("  Los  Angeles ")).toBe("los-angeles");
  });
});

describe("nearbyCities", () => {
  it("returns the closest cities in distance order, never the city itself", () => {
    const cerritos = city("Cerritos", 33.86, -118.06);
    const artesia = city("Artesia", 33.87, -118.08);
    const norwalk = city("Norwalk", 33.91, -118.08);
    const sanDiego = city("San Diego", 32.72, -117.16);
    const all = [sanDiego, norwalk, cerritos, artesia];
    expect(nearbyCities(cerritos, all, 2).map((c) => c.name)).toEqual(["Artesia", "Norwalk"]);
  });
});

describe("refreshCityPages", () => {
  it("saves only cities with at least 20 for-sale listings", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { name: "Cerritos", county: "Los Angeles", n: 20, lat: 33.86, lng: -118.06 },
      { name: "Hawaiian Gardens", county: "Los Angeles", n: 19, lat: 33.83, lng: -118.07 },
    ] as never);
    const res = await refreshCityPages();
    expect(res).toEqual({ cities: 1 });
    const [key, value] = vi.mocked(redis.set).mock.calls[0];
    expect(key).toBe(CITY_PAGES_KEY);
    const saved = JSON.parse(value as string) as CityPage[];
    expect(saved).toEqual([
      { slug: "cerritos", name: "Cerritos", county: "Los Angeles", count: 20, lat: 33.86, lng: -118.06 },
    ]);
  });
});

describe("refreshCityPages spelling variants", () => {
  it("merges groups that make the same page address", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { name: "La Cañada Flintridge", county: "Los Angeles", n: 30, lat: 34.2, lng: -118.2 },
      { name: "La Canada Flintridge", county: "Los Angeles", n: 10, lat: 34.6, lng: -118.6 },
    ] as never);
    expect(await refreshCityPages()).toEqual({ cities: 1 });
    const saved = JSON.parse(vi.mocked(redis.set).mock.calls[0][1] as string) as CityPage[];
    expect(saved).toEqual([
      { slug: "la-canada-flintridge", name: "La Cañada Flintridge", county: "Los Angeles", count: 40, lat: 34.3, lng: -118.3 },
    ]);
  });
  it("keeps a city whose variants only reach 20 together", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { name: "Cerritos", county: "Los Angeles", n: 15, lat: 1, lng: 1 },
      { name: "CERRITOS", county: "Los Angeles", n: 5, lat: 1, lng: 1 },
    ] as never);
    expect(await refreshCityPages()).toEqual({ cities: 1 });
  });
});

describe("getCityPages", () => {
  it("fails loudly when Redis can't be read, so pages error instead of 404ing", async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error("redis down"));
    await expect(getCityPages()).rejects.toThrow();
  });
  it("is null when nothing is saved", async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    expect(await getCityPages()).toBeNull();
  });
  it("returns the saved list", async () => {
    const list = [city("Cerritos", 33.86, -118.06)];
    vi.mocked(redis.get).mockResolvedValue(list as never);
    expect(await getCityPages()).toEqual(list);
  });
});

describe("cityPageMeta", () => {
  it("titles and canonicalises the page by city", () => {
    const meta = cityPageMeta(city("Cerritos", 33.86, -118.06));
    expect(meta.title).toBe("Homes for Sale in Cerritos, CA");
    expect(meta.alternates?.canonical).toBe("/homes-for-sale/cerritos");
    expect(String(meta.description)).toContain("30+ homes for sale in Cerritos, CA");
  });
});
