import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { upsert: vi.fn() } },
}));
vi.mock("@/lib/idx/client", () => ({
  fetchProperties: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";
import { GET } from "../../app/api/idx/sync/route";

function makeRequest(secret: string) {
  return new Request("http://localhost/api/idx/sync?type=delta", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/idx/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("skips upserting a Closed FOR_RENT record but keeps Active FOR_RENT and Closed FOR_SALE", async () => {
    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield [
        { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" } as any,
        { mlsNumber: "ML2", status: "Active", listingType: "FOR_RENT" } as any,
        { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE" } as any,
      ];
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upserted).toBe(2);

    expect(prisma.property.upsert).toHaveBeenCalledTimes(2);
    const upsertedIds = vi.mocked(prisma.property.upsert).mock.calls.map(
      (call) => (call[0] as any).where.mlsNumber
    );
    expect(upsertedIds).toEqual(["ML2", "ML3"]);
  });

  it("writes a lightweight record (no photos/details) for closed sales older than 1 year, full record otherwise", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00.000Z"));

    const withinYear = new Date("2026-01-01T00:00:00.000Z");
    const overYearAgo = new Date("2025-01-01T00:00:00.000Z");

    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield [
        { mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE", closeDate: null, photos: ["a.jpg"], details: { Roof: "Tile" } } as any,
        { mlsNumber: "ML2", status: "Closed", listingType: "FOR_SALE", closeDate: withinYear, photos: ["b.jpg"], details: { Roof: "Shingle" } } as any,
        { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE", closeDate: overYearAgo, photos: ["c.jpg"], details: { Roof: "Metal" } } as any,
      ];
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);

    const calls = vi.mocked(prisma.property.upsert).mock.calls;
    const byId = Object.fromEntries(calls.map((call) => [(call[0] as any).where.mlsNumber, (call[0] as any).create]));

    expect(byId.ML1.photos).toEqual(["a.jpg"]);
    expect(byId.ML1.details).toEqual({ Roof: "Tile" });
    expect(byId.ML2.photos).toEqual(["b.jpg"]);
    expect(byId.ML2.details).toEqual({ Roof: "Shingle" });
    expect(byId.ML3.photos).toEqual([]);
    expect(byId.ML3.details).toBeNull();

    vi.useRealTimers();
  });
});
