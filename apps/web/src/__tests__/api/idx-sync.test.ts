import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { upsert: vi.fn() },
    syncProgress: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/idx/client", () => ({
  fetchProperties: vi.fn(),
  // Pure predicate; keep the real behaviour so the resume/discard branch is
  // exercised rather than stubbed away.
  isKeyCursor: (v: string | undefined | null) => !!v && /^\d+$/.test(v),
}));

import { prisma } from "@/lib/prisma";
import { Prisma } from "@cnc/database";
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
    vi.mocked(prisma.syncProgress.findUnique).mockResolvedValue(null);
    // clearAllMocks resets calls but NOT implementations, so a test that makes
    // upsert throw leaks that behaviour into every test after it. Restore a
    // succeeding default; the tests that need failures set their own.
    vi.mocked(prisma.property.upsert).mockImplementation((async () => ({})) as never);
  });

  it("skips upserting a Closed FOR_RENT record but keeps Active FOR_RENT and Closed FOR_SALE", async () => {
    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield {
        properties: [
          { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" } as any,
          { mlsNumber: "ML2", status: "Active", listingType: "FOR_RENT" } as any,
          { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE" } as any,
        ],
        cursor: "2021-05-01T00:00:00.000Z",
      };
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
    try {
      vi.setSystemTime(new Date("2026-07-13T12:00:00.000Z"));

      const withinYear = new Date("2026-01-01T00:00:00.000Z");
      const overYearAgo = new Date("2025-01-01T00:00:00.000Z");

      vi.mocked(fetchProperties).mockImplementation(async function* () {
        yield {
          properties: [
            { mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE", closeDate: null, photos: ["a.jpg"], details: { Roof: "Tile" } } as any,
            { mlsNumber: "ML2", status: "Closed", listingType: "FOR_SALE", closeDate: withinYear, photos: ["b.jpg"], details: { Roof: "Shingle" } } as any,
            { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE", closeDate: overYearAgo, photos: ["c.jpg"], details: { Roof: "Metal" } } as any,
          ],
          cursor: "2021-05-01T00:00:00.000Z",
        };
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
      expect(byId.ML3.details).toBe(Prisma.DbNull);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips a Closed FOR_RENT record even when it is also older than 1 year", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-13T12:00:00.000Z"));

      const overYearAgo = new Date("2025-01-01T00:00:00.000Z");

      vi.mocked(fetchProperties).mockImplementation(async function* () {
        yield {
          properties: [
            {
              mlsNumber: "ML1",
              status: "Closed",
              listingType: "FOR_RENT",
              closeDate: overYearAgo,
              photos: ["a.jpg"],
              details: { Roof: "Tile" },
            } as any,
          ],
          cursor: "2021-05-01T00:00:00.000Z",
        };
      });

      const res = await GET(makeRequest("test-secret"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.upserted).toBe(0);

      expect(prisma.property.upsert).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes from a saved checkpoint by passing its stored cursor into fetchProperties", async () => {
    vi.mocked(prisma.syncProgress.findUnique).mockResolvedValue({
      id: "sp1",
      syncType: "full",
      nextLink: "421448857",
      updatedAt: new Date(),
    } as any);
    vi.mocked(fetchProperties).mockImplementation(async function* () {});

    const res = await GET(
      new Request("http://localhost/api/idx/sync?type=full", {
        headers: { authorization: "Bearer test-secret" },
      })
    );
    expect(res.status).toBe(200);

    expect(prisma.syncProgress.findUnique).toHaveBeenCalledWith({ where: { syncType: "full" } });
    expect(fetchProperties).toHaveBeenCalledWith(undefined, "421448857");
  });

  it("saves the cursor after every page and clears the checkpoint once the crawl finishes", async () => {
    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield {
        properties: [{ mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE" } as any],
        cursor: "2021-05-01T00:00:00.000Z",
      };
      yield {
        properties: [{ mlsNumber: "ML2", status: "Active", listingType: "FOR_SALE" } as any],
        cursor: "2021-05-02T00:00:00.000Z",
      };
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);

    expect(prisma.syncProgress.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.syncProgress.upsert).toHaveBeenNthCalledWith(1, {
      where: { syncType: "delta" },
      create: { syncType: "delta", nextLink: "2021-05-01T00:00:00.000Z" },
      update: { nextLink: "2021-05-01T00:00:00.000Z" },
    });
    expect(prisma.syncProgress.deleteMany).toHaveBeenCalledWith({ where: { syncType: "delta" } });
  });

  it("upserts a page's records concurrently rather than one at a time", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(prisma.property.upsert).mockImplementation((async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setImmediate(r));
      inFlight--;
      return {} as any;
    }) as any);

    const properties = Array.from({ length: 30 }, (_, i) => ({
      mlsNumber: `ML${i}`,
      status: "Active",
      listingType: "FOR_SALE",
    })) as any[];

    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield { properties, cursor: "2021-05-01T00:00:00.000Z" };
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);
    expect((await res.json()).upserted).toBe(30);

    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("counts an individual upsert failure as an error without dropping the rest of the page", async () => {
    vi.mocked(prisma.property.upsert).mockImplementation((async (args: any) => {
      if (args.where.mlsNumber === "ML2") throw new Error("P1017 server has closed the connection");
      return {} as any;
    }) as any);

    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield {
        properties: [
          { mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE" } as any,
          { mlsNumber: "ML2", status: "Active", listingType: "FOR_SALE" } as any,
          { mlsNumber: "ML3", status: "Active", listingType: "FOR_SALE" } as any,
        ],
        cursor: "2021-05-01T00:00:00.000Z",
      };
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.upserted).toBe(2);
    expect(body.errors).toBe(1);
  });

  describe("skipped accounting", () => {
    // A deliberate exclusion that is reported as neither an upsert nor an error
    // is indistinguishable from silent data loss. Reconciling a finished crawl
    // against the feed cost a full investigation for exactly this reason.
    it("reports how many records the closed-rental filter skipped", async () => {
      vi.mocked(fetchProperties).mockImplementation(async function* () {
        yield {
          properties: [
            { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" } as any,
            { mlsNumber: "ML2", status: "Active", listingType: "FOR_RENT" } as any,
            { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE" } as any,
          ],
          cursor: "421448857",
        };
      });

      const body = await (await GET(makeRequest("test-secret"))).json();
      expect(body.upserted).toBe(2);
      expect(body.errors).toBe(0);
      expect(body.skipped).toBe(1);
    });

    it("reports zero skipped when the page has nothing to filter out", async () => {
      vi.mocked(fetchProperties).mockImplementation(async function* () {
        yield {
          properties: [{ mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE" } as any],
          cursor: "421448857",
        };
      });

      expect((await (await GET(makeRequest("test-secret"))).json()).skipped).toBe(0);
    });

    it("accumulates skipped across pages", async () => {
      vi.mocked(fetchProperties).mockImplementation(async function* () {
        yield {
          properties: [
            { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" } as any,
            { mlsNumber: "ML2", status: "Active", listingType: "FOR_SALE" } as any,
          ],
          cursor: "421448857",
        };
        yield {
          properties: [
            { mlsNumber: "ML3", status: "Closed", listingType: "FOR_RENT" } as any,
            { mlsNumber: "ML4", status: "Closed", listingType: "FOR_RENT" } as any,
          ],
          cursor: "421448999",
        };
      });

      const body = await (await GET(makeRequest("test-secret"))).json();
      expect(body.skipped).toBe(3);
      expect(body.upserted).toBe(1);
    });

    it("accounts for every fetched record as upserted, skipped, or errored", async () => {
      vi.mocked(prisma.property.upsert).mockImplementation((async (args: any) => {
        if (args.where.mlsNumber === "ML4") throw new Error("connection reset");
        return {} as any;
      }) as any);

      const properties = [
        { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" },
        { mlsNumber: "ML2", status: "Active", listingType: "FOR_SALE" },
        { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE" },
        { mlsNumber: "ML4", status: "Active", listingType: "FOR_RENT" },
      ] as any[];

      vi.mocked(fetchProperties).mockImplementation(async function* () {
        yield { properties, cursor: "421448857" };
      });

      const body = await (await GET(makeRequest("test-secret"))).json();

      // The invariant that makes the log trustworthy: nothing vanishes.
      expect(body.upserted + body.skipped + body.errors).toBe(properties.length);
    });
  });

  it("keeps the checkpoint when the crawl fails partway, so the next run can resume", async () => {
    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield {
        properties: [{ mlsNumber: "ML1", status: "Active", listingType: "FOR_SALE" } as any],
        cursor: "2021-05-01T00:00:00.000Z",
      };
      throw new Error("RESO fetch failed: 500");
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(500);

    expect(prisma.syncProgress.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.syncProgress.deleteMany).not.toHaveBeenCalled();
  });
});
