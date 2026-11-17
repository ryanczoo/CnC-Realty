import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSettings: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getConnection, saveConnection, markBroken, deleteConnection } from "@/lib/google-calendar/connection";

// In-memory fake row so saved values can be read back.
let row: { value: string } | null;

describe("google calendar connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_TOKEN_KEY", randomBytes(32).toString("base64"));
    row = null;
    vi.mocked(prisma.siteSettings.findUnique).mockImplementation((async () => row) as any);
    vi.mocked(prisma.siteSettings.upsert).mockImplementation((async (args: any) => {
      row = { value: args.update.value };
      return row;
    }) as any);
    vi.mocked(prisma.siteSettings.updateMany).mockImplementation((async (args: any) => {
      if (row && row.value === args.where.value) {
        row = { value: args.data.value };
        return { count: 1 };
      }
      return { count: 0 };
    }) as any);
    vi.mocked(prisma.siteSettings.deleteMany).mockImplementation((async () => {
      row = null;
      return { count: 1 };
    }) as any);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns null when nothing is stored", async () => {
    expect(await getConnection()).toBeNull();
  });

  it("saves encrypted and reads back", async () => {
    await saveConnection("ryan@x.com", "refresh-abc");
    const args = vi.mocked(prisma.siteSettings.upsert).mock.calls[0][0] as any;
    expect(args.where).toEqual({ key: "google_calendar" });
    expect(args.update.value).not.toContain("refresh-abc");
    const c = await getConnection();
    expect(c).toMatchObject({ status: "connected", email: "ryan@x.com", refreshToken: "refresh-abc", alertSentAt: null });
    expect(typeof c!.connectedAt).toBe("string");
  });

  it("markBroken returns firstTime true once, then false", async () => {
    await saveConnection("ryan@x.com", "r");
    expect(await markBroken()).toEqual({ firstTime: true });
    const c = await getConnection();
    expect(c!.status).toBe("broken");
    expect(c!.alertSentAt).not.toBeNull();
    expect(await markBroken()).toEqual({ firstTime: false });
  });

  it("markBroken with no row does nothing", async () => {
    expect(await markBroken()).toEqual({ firstTime: false });
    expect(prisma.siteSettings.upsert).not.toHaveBeenCalled();
    expect(prisma.siteSettings.updateMany).not.toHaveBeenCalled();
  });

  it("two concurrent markBroken calls: exactly one gets firstTime true", async () => {
    await saveConnection("ryan@x.com", "r");
    const results = await Promise.all([markBroken(), markBroken()]);
    expect(results.filter((r) => r.firstTime)).toHaveLength(1);
    expect((await getConnection())!.status).toBe("broken");
  });

  it("markBroken does not clobber a concurrent saveConnection", async () => {
    await saveConnection("ryan@x.com", "old");
    const realFind = vi.mocked(prisma.siteSettings.findUnique).getMockImplementation()!;
    // After markBroken reads, Ryan reconnects before the write lands.
    vi.mocked(prisma.siteSettings.findUnique).mockImplementationOnce((async (a: any) => {
      const stale = await (realFind as any)(a);
      await saveConnection("ryan@x.com", "new");
      return stale;
    }) as any);
    expect(await markBroken()).toEqual({ firstTime: false });
    const c = await getConnection();
    expect(c).toMatchObject({ status: "connected", refreshToken: "new", alertSentAt: null });
  });

  it("markBroken when already broken with alert sent does not write", async () => {
    await saveConnection("ryan@x.com", "r");
    await markBroken();
    vi.mocked(prisma.siteSettings.updateMany).mockClear();
    expect(await markBroken()).toEqual({ firstTime: false });
    expect(prisma.siteSettings.updateMany).not.toHaveBeenCalled();
  });

  it("saveConnection after broken resets alert state", async () => {
    await saveConnection("a@x.com", "r");
    await markBroken();
    await saveConnection("a@x.com", "r2");
    expect((await getConnection())!.alertSentAt).toBeNull();
    expect(await markBroken()).toEqual({ firstTime: true });
  });

  it("deleteConnection removes the row", async () => {
    await saveConnection("a@x.com", "r");
    await deleteConnection();
    expect(prisma.siteSettings.deleteMany).toHaveBeenCalledWith({ where: { key: "google_calendar" } });
    expect(await getConnection()).toBeNull();
  });
});
