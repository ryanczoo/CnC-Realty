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
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("fetchProperties resilience", () => {
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
    // Attach a no-op handler immediately so a rejection settling while we
    // advance fake timers below isn't flagged as unhandled — the real
    // rejection still propagates via the returned `resultPromise` itself.
    resultPromise.catch(() => {});
    await vi.advanceTimersByTimeAsync(100_000);
    return resultPromise;
  }

  it("retries a page after a transient 5xx response and succeeds on the next attempt", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ value: [{ ListingKey: "A" }] }));

    const results = await drainFast(fetchProperties());

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(results).toEqual([{ properties: [{ mlsNumber: "A" }], nextLink: null }]);
  });

  it("retries a page after a network-level throw and succeeds on the next attempt", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse({ value: [{ ListingKey: "A" }] }));

    const results = await drainFast(fetchProperties());

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(results).toEqual([{ properties: [{ mlsNumber: "A" }], nextLink: null }]);
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

  it("skips a single malformed record without failing the rest of the batch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        value: [{ ListingKey: "A" }, { ListingKey: "BAD" }, { ListingKey: "C" }],
      })
    );

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([{ properties: [{ mlsNumber: "A" }, { mlsNumber: "C" }], nextLink: null }]);
  });

  it("fetches startUrl directly instead of building a fresh base URL, when given", async () => {
    const resumeUrl = "https://api-trestle.corelogic.com/trestle/odata/Property?%24skiptoken=abc123";
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ value: [{ ListingKey: "A" }] }));

    await drainFast(fetchProperties(undefined, resumeUrl));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(resumeUrl);
  });

  it("yields the page's nextLink alongside its properties, for checkpointing", async () => {
    const page2Url = "https://api-trestle.corelogic.com/trestle/odata/Property?%24skiptoken=page2";
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ value: [{ ListingKey: "A" }], "@odata.nextLink": page2Url }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ ListingKey: "B" }] }));

    const results = await drainFast(fetchProperties());

    expect(results).toEqual([
      { properties: [{ mlsNumber: "A" }], nextLink: page2Url },
      { properties: [{ mlsNumber: "B" }], nextLink: null },
    ]);
  });
});
