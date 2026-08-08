import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/idx/auth", () => ({
  getResoToken: vi.fn().mockResolvedValue("test-token"),
}));
vi.mock("@/lib/idx/field-map", () => ({
  mapResoToProperty: vi.fn((raw: any) => {
    if (raw.ListingKey === "BAD") throw new Error("malformed record");
    return { mlsNumber: raw.ListingKey };
  }),
}));

import { buildPropertyFilter, fetchProperties } from "@/lib/idx/client";

describe("buildPropertyFilter", () => {
  it("includes the status filter with no ModificationTimestamp clause when modifiedSince is omitted", () => {
    expect(buildPropertyFilter()).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')&"
    );
  });

  it("combines the status filter with a ModificationTimestamp clause when modifiedSince is given", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    expect(buildPropertyFilter(since)).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ModificationTimestamp gt 2026-07-01T00:00:00.000Z&"
    );
  });

  it("accepts an ISO cursor string as well as a Date", () => {
    expect(buildPropertyFilter("2026-07-01T00:00:00.000Z")).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ModificationTimestamp gt 2026-07-01T00:00:00.000Z&"
    );
  });
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function record(key: string, ts: string) {
  return { ListingKey: key, ModificationTimestamp: ts };
}

const EMPTY_PAGE = { value: [] };

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("fetchProperties keyset pagination", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Retry delays use real setTimeout under the hood; fast-forward fake time
  // concurrently with draining so these tests don't actually wait seconds.
  async function drainFast<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const resultPromise = drain(gen);
    resultPromise.catch(() => {});
    await vi.advanceTimersByTimeAsync(100_000);
    return resultPromise;
  }

  function urlAt(i: number): string {
    return vi.mocked(fetch).mock.calls[i][0] as string;
  }

  it("orders by ModificationTimestamp so the cursor can advance deterministically", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    expect(urlAt(0)).toContain("$orderby=ModificationTimestamp");
  });

  it("never sends $skip, so it cannot hit Trestle's 1,000,000 offset ceiling", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("A", "2021-05-01T00:00:00.000Z")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    for (const call of vi.mocked(fetch).mock.calls) {
      expect(call[0] as string).not.toContain("$skip");
    }
  });

  it("ignores @odata.nextLink entirely, since Trestle builds it with $skip", async () => {
    const skipLink = "https://api.cotality.com/trestle/odata/Property?$skip=200";
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ value: [record("A", "2021-05-01T00:00:00.000Z")], "@odata.nextLink": skipLink })
      )
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    expect(urlAt(1)).not.toBe(skipLink);
  });

  it("yields the last record's ModificationTimestamp as the next cursor", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          value: [record("A", "2021-05-01T00:00:00.000Z"), record("B", "2021-05-02T00:00:00.000Z")],
        })
      )
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([
      {
        properties: [{ mlsNumber: "A" }, { mlsNumber: "B" }],
        cursor: "2021-05-02T00:00:00.000Z",
      },
    ]);
  });

  it("requests the following page filtered on the advanced cursor", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("A", "2021-05-02T00:00:00.000Z")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    expect(decodeURIComponent(urlAt(1))).toContain(
      "ModificationTimestamp gt 2021-05-02T00:00:00.000Z"
    );
  });

  it("resumes from a saved cursor instead of crawling from the beginning", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties(undefined, "2021-06-01T00:00:00.000Z"));

    expect(decodeURIComponent(urlAt(0))).toContain(
      "ModificationTimestamp gt 2021-06-01T00:00:00.000Z"
    );
  });

  it("ignores a saved cursor that is not a timestamp, e.g. a legacy $skip nextLink", async () => {
    const legacy = "https://api.cotality.com/trestle/odata/Property?$skip=1000000";
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties(undefined, legacy));

    expect(urlAt(0)).not.toContain("$skip");
    expect(decodeURIComponent(urlAt(0))).not.toContain("ModificationTimestamp gt");
  });

  it("stops once a page comes back empty", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("A", "2021-05-01T00:00:00.000Z")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws rather than looping forever when a page has no usable ModificationTimestamp", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ value: [{ ListingKey: "A" }, { ListingKey: "B" }] })
    );

    await expect(drainFast(fetchProperties())).rejects.toThrow(/ModificationTimestamp/);
  });

  it("skips a single malformed record without failing the rest of the batch", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            record("A", "2021-05-01T00:00:00.000Z"),
            record("BAD", "2021-05-02T00:00:00.000Z"),
            record("C", "2021-05-03T00:00:00.000Z"),
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results[0].properties).toEqual([{ mlsNumber: "A" }, { mlsNumber: "C" }]);
  });

  it("still advances the cursor past a malformed record that ends a page", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          value: [record("A", "2021-05-01T00:00:00.000Z"), record("BAD", "2021-05-09T00:00:00.000Z")],
        })
      )
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results[0].cursor).toBe("2021-05-09T00:00:00.000Z");
  });
});

describe("fetchProperties resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function drainFast<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const resultPromise = drain(gen);
    resultPromise.catch(() => {});
    await vi.advanceTimersByTimeAsync(100_000);
    return resultPromise;
  }

  it("retries a page after a transient 5xx response and succeeds on the next attempt", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ value: [record("A", "2021-05-01T00:00:00.000Z")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([
      { properties: [{ mlsNumber: "A" }], cursor: "2021-05-01T00:00:00.000Z" },
    ]);
  });

  it("retries a page after a network-level throw and succeeds on the next attempt", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse({ value: [record("A", "2021-05-01T00:00:00.000Z")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([
      { properties: [{ mlsNumber: "A" }], cursor: "2021-05-01T00:00:00.000Z" },
    ]);
  });

  it("does not retry a non-5xx, non-401 error response and throws immediately", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "bad filter" }, 400));

    await expect(drainFast(fetchProperties())).rejects.toThrow(/400/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries on a persistently failing page", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    await expect(drainFast(fetchProperties())).rejects.toThrow(/500/);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(1);
  });
});
