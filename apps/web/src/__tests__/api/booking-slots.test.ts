import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const store = new Map<string, unknown>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: unknown) => {
      store.set(k, v);
      return "OK";
    }),
    del: vi.fn(async (k: string) => {
      store.delete(k);
      return 1;
    }),
  },
}));
vi.mock("@/lib/google-calendar/connection", () => ({ getConnection: vi.fn() }));
vi.mock("@/lib/google-calendar/api", () => ({
  freeBusy: vi.fn(),
  withGoogle: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findMany: vi.fn() } } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { getConnection } from "@/lib/google-calendar/connection";
import { freeBusy } from "@/lib/google-calendar/api";
import { redis } from "@/lib/redis";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getBusy } from "@/lib/booking/busy";
import { GET } from "@/app/api/booking/slots/route";

// 2026-11-17 10:00 PT = 18:00Z
const NOW = new Date("2026-11-16T17:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(getConnection).mockResolvedValue({ status: "connected" } as never);
  vi.mocked(freeBusy).mockResolvedValue([]);
  vi.mocked(prisma.booking.findMany).mockResolvedValue([] as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function days() {
  const res = await GET();
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  return res.json();
}

describe("GET /api/booking/slots", () => {
  it("lists slots and excludes a Google-busy slot", async () => {
    vi.mocked(freeBusy).mockResolvedValue([
      { start: new Date("2026-11-17T18:00:00Z"), end: new Date("2026-11-17T18:15:00Z") },
    ]);
    const body = await days();
    expect(body.status).toBe("ok");
    expect(body.days["2026-11-17"]).toContain("2026-11-17T17:45:00.000Z");
    expect(body.days["2026-11-17"]).not.toContain("2026-11-17T18:00:00.000Z");
  });

  it("excludes an ACTIVE DB booking slot", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      { startsAt: new Date("2026-11-17T19:00:00Z"), endsAt: new Date("2026-11-17T19:15:00Z") },
    ] as never);
    const body = await days();
    expect(body.days["2026-11-17"]).not.toContain("2026-11-17T19:00:00.000Z");
    const where = vi.mocked(prisma.booking.findMany).mock.calls[0][0]!.where as Record<string, unknown>;
    expect(where.status).toBe("ACTIVE");
  });

  it("no connection -> unavailable", async () => {
    vi.mocked(getConnection).mockResolvedValue(null);
    expect(await days()).toEqual({ status: "unavailable" });
  });

  it("broken connection -> unavailable", async () => {
    vi.mocked(getConnection).mockResolvedValue({ status: "broken" } as never);
    expect(await days()).toEqual({ status: "unavailable" });
  });

  it("unreadable connection or Google error -> unavailable with 200", async () => {
    vi.mocked(getConnection).mockRejectedValue(new Error("bad blob"));
    expect(await days()).toEqual({ status: "unavailable" });
    vi.mocked(getConnection).mockResolvedValue({ status: "connected" } as never);
    vi.mocked(freeBusy).mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });
});

describe("route cache and failures", () => {
  it("two GETs a few seconds apart call freeBusy once", async () => {
    await GET();
    vi.setSystemTime(new Date(NOW.getTime() + 5000));
    await GET();
    expect(freeBusy).toHaveBeenCalledTimes(1);
  });

  it("reports the underlying Google error to Sentry", async () => {
    const boom = new Error("quota");
    vi.mocked(freeBusy).mockRejectedValue(boom);
    expect(await days()).toEqual({ status: "unavailable" });
    expect(Sentry.captureException).toHaveBeenCalledWith(boom);
  });

  it("not-connected case is not reported", async () => {
    vi.mocked(getConnection).mockResolvedValue(null);
    await GET();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejecting redis falls back to Google", async () => {
    vi.mocked(redis.get).mockRejectedValueOnce(new Error("down"));
    vi.mocked(redis.set).mockRejectedValueOnce(new Error("down"));
    const body = await days();
    expect(body.status).toBe("ok");
    expect(freeBusy).toHaveBeenCalledTimes(1);
  });
});

describe("getBusy cache", () => {
  const from = new Date("2026-11-16T00:00:00Z");
  const to = new Date("2026-12-01T00:00:00Z");

  it("second call within TTL does not call freeBusy again", async () => {
    vi.mocked(freeBusy).mockResolvedValue([
      { start: new Date("2026-11-17T18:00:00Z"), end: new Date("2026-11-17T18:15:00Z") },
    ]);
    await getBusy(from, to);
    const second = await getBusy(from, to);
    expect(freeBusy).toHaveBeenCalledTimes(1);
    expect(second[0].start).toBeInstanceOf(Date);
  });

  it("fresh: true bypasses the cache", async () => {
    await getBusy(from, to);
    await getBusy(from, to, { fresh: true });
    expect(freeBusy).toHaveBeenCalledTimes(2);
  });

  it("DB bookings are read every time even when Google is cached", async () => {
    await getBusy(from, to);
    await getBusy(from, to);
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
  });
});

describe("getBusy excludeBookingId", () => {
  const from = new Date("2026-11-16T00:00:00Z");
  const to = new Date("2026-12-01T00:00:00Z");

  it("excludes that booking id from the DB query", async () => {
    await getBusy(from, to, { excludeBookingId: "b1" });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE", id: { not: "b1" } }),
      })
    );
  });

  it("does not filter by id when not given", async () => {
    await getBusy(from, to);
    const arg = vi.mocked(prisma.booking.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).not.toHaveProperty("id");
  });
});
