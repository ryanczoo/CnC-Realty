import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/idx/auth", () => ({
  getResoToken: vi.fn().mockResolvedValue("fake-token"),
}));
vi.mock("@/lib/idx/field-map", () => ({
  mapResoToProperty: vi.fn((p: unknown) => p),
}));

import { fetchProperties } from "@/lib/idx/client";

function mockFetchOnce() {
  global.fetch = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [] }),
    });
  }) as unknown as typeof fetch;
}

describe("fetchProperties — CloseDate age filter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("full sync excludes Closed listings older than 8 years, keeps other statuses unfiltered by date", async () => {
    mockFetchOnce();
    const gen = fetchProperties();
    await gen.next();

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("StandardStatus ne 'Closed'");
    expect(calledUrl).toContain("CloseDate ge 2018-07-09");
  });

  it("delta sync combines ModificationTimestamp filter with the CloseDate age filter", async () => {
    mockFetchOnce();
    const gen = fetchProperties(new Date("2026-07-08T00:00:00.000Z"));
    await gen.next();

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("ModificationTimestamp gt 2026-07-08");
    expect(calledUrl).toContain("StandardStatus ne 'Closed'");
    expect(calledUrl).toContain("CloseDate ge 2018-07-09");
  });
});
