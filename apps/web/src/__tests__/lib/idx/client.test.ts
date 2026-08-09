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
  it("includes the status filter with no extra clauses when nothing is passed", () => {
    expect(buildPropertyFilter()).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')&"
    );
  });

  it("adds a ModificationTimestamp clause when modifiedSince is given", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    expect(buildPropertyFilter(since)).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ModificationTimestamp gt 2026-07-01T00:00:00.000Z&"
    );
  });

  it("adds a ListingKeyNumeric clause when a page cursor is given", () => {
    expect(buildPropertyFilter(undefined, "421448857")).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ListingKeyNumeric gt 421448857&"
    );
  });

  it("combines both clauses for a delta sync mid-page", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    expect(buildPropertyFilter(since, "421448857")).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ModificationTimestamp gt 2026-07-01T00:00:00.000Z and ListingKeyNumeric gt 421448857&"
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

// ListingKeyNumeric is the unique integer primary key. ModificationTimestamp is
// deliberately duplicated across records here — that is the real shape of the
// feed (793 records were observed sharing one timestamp) and is what broke the
// previous cursor.
function record(key: string, ts = "2021-04-30T13:23:56.083-00:00") {
  return { ListingKey: key, ListingKeyNumeric: Number(key), ModificationTimestamp: ts };
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

  async function drainFast<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const resultPromise = drain(gen);
    resultPromise.catch(() => {});
    await vi.advanceTimersByTimeAsync(100_000);
    return resultPromise;
  }

  function urlAt(i: number): string {
    return vi.mocked(fetch).mock.calls[i][0] as string;
  }

  it("orders by ListingKeyNumeric, a unique key, so tied timestamps cannot cause skips", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    expect(urlAt(0)).toContain("$orderby=ListingKeyNumeric");
    expect(urlAt(0)).not.toContain("$orderby=ModificationTimestamp");
  });

  it("selects ListingKeyNumeric, without which the cursor could not advance", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    expect(urlAt(0)).toContain("ListingKeyNumeric");
  });

  it("never sends $skip, so it cannot hit Trestle's 1,000,000 offset ceiling", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("100")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    for (const call of vi.mocked(fetch).mock.calls) {
      expect(call[0] as string).not.toContain("$skip");
    }
  });

  it("yields the last record's ListingKeyNumeric as the next cursor", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("100"), record("205")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([
      { properties: [{ mlsNumber: "100" }, { mlsNumber: "205" }], cursor: "205" },
    ]);
  });

  it("advances past every record on a page even when they all share one timestamp", async () => {
    const tied = [record("100"), record("101"), record("102")]; // identical ModificationTimestamp
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: tied }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties());

    expect(decodeURIComponent(urlAt(1))).toContain("ListingKeyNumeric gt 102");
    expect(decodeURIComponent(urlAt(1))).not.toContain("ModificationTimestamp gt");
  });

  it("resumes from a saved key cursor instead of crawling from the beginning", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties(undefined, "421448857"));

    expect(decodeURIComponent(urlAt(0))).toContain("ListingKeyNumeric gt 421448857");
  });

  it("ignores a timestamp cursor left by the previous pagination scheme", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties(undefined, "2026-06-25T03:40:00.000Z"));

    expect(decodeURIComponent(urlAt(0))).not.toContain("ListingKeyNumeric gt");
  });

  it("ignores a legacy $skip nextLink checkpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    await drainFast(fetchProperties(undefined, "https://api.cotality.com/trestle/odata/Property?$skip=1000000"));

    expect(urlAt(0)).not.toContain("$skip");
    expect(decodeURIComponent(urlAt(0))).not.toContain("ListingKeyNumeric gt");
  });

  it("stops once a page comes back empty", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("100")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws rather than looping forever when a page has no usable ListingKeyNumeric", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ value: [{ ListingKey: "A" }, { ListingKey: "B" }] })
    );

    await expect(drainFast(fetchProperties())).rejects.toThrow(/ListingKeyNumeric/);
  });

  it("skips a single malformed record without failing the rest of the batch", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("100"), record("BAD"), record("102")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results[0].properties).toEqual([{ mlsNumber: "100" }, { mlsNumber: "102" }]);
  });

  it("still advances the cursor past a malformed record that ends a page", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [record("100"), { ...record("999"), ListingKey: "BAD" }] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results[0].cursor).toBe("999");
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
      .mockResolvedValueOnce(jsonResponse({ value: [record("100")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([{ properties: [{ mlsNumber: "100" }], cursor: "100" }]);
  });

  it("retries a page after a network-level throw and succeeds on the next attempt", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse({ value: [record("100")] }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_PAGE));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([{ properties: [{ mlsNumber: "100" }], cursor: "100" }]);
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
