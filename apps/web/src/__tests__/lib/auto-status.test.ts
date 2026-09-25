import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findMany: vi.fn(), update: vi.fn() },
    transactionFile: { findMany: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { runAutoStatus, pacificToday, dateDrivenStatus } from "@/lib/auto-status";

// 2026-09-24 at 10:00 Pacific (17:00 UTC) — the morning job's run time.
const NOW = new Date("2026-09-24T17:00:00.000Z");
const TODAY = new Date("2026-09-24T00:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.listingFile.findMany).mockResolvedValue([]);
  vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([]);
  vi.mocked(prisma.listingFile.update).mockResolvedValue({} as any);
  vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(prisma.$transaction).mockImplementation((async (ops: Promise<unknown>[]) => Promise.all(ops)) as any);
});

describe("pacificToday", () => {
  it("returns today's Pacific calendar date as UTC midnight (how date-only fields are stored)", () => {
    expect(pacificToday(NOW)).toEqual(TODAY);
  });

  it("is still the previous day late in the evening Pacific, even though UTC has rolled over", () => {
    expect(pacificToday(new Date("2026-09-25T05:00:00.000Z"))).toEqual(TODAY); // 10pm Pacific on the 24th
  });
});

describe("runAutoStatus", () => {
  it("queries only the four date-driven groups, and never Incomplete listings", async () => {
    await runAutoStatus(NOW);
    const listingWheres = vi.mocked(prisma.listingFile.findMany).mock.calls.map((c) => (c[0] as any).where);
    expect(listingWheres).toEqual(expect.arrayContaining([
      { status: { in: ["ACTIVE", "COMING_SOON"] }, expirationDate: { lt: TODAY } },
      { status: "COMING_SOON", listDate: { lte: TODAY }, OR: [{ expirationDate: null }, { expirationDate: { gte: TODAY } }] },
    ]));
    for (const w of listingWheres) expect(JSON.stringify(w)).not.toContain("INCOMPLETE");
    const txWheres = vi.mocked(prisma.transactionFile.findMany).mock.calls.map((c) => (c[0] as any).where);
    expect(txWheres).toEqual(expect.arrayContaining([
      { status: "PENDING", closeOfEscrow: { lt: TODAY } },
      { status: "EXPIRED", closeOfEscrow: { gte: TODAY } },
    ]));
  });

  it("expires a listing past its expiration date and logs it as automatic, under the listing's agent", async () => {
    vi.mocked(prisma.listingFile.findMany).mockImplementation((async (args: any) =>
      args.where.expirationDate ? [{ id: "l1", status: "ACTIVE", agent: { userId: "u1" } }] : []) as any);

    const result = await runAutoStatus(NOW);

    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { status: "EXPIRED" } });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: {
      fileType: "LISTING", listingFileId: "l1", transactionFileId: null,
      actorId: "u1", actorRole: "AGENT", type: "STATUS_CHANGED",
      payload: { from: "ACTIVE", to: "EXPIRED", automatic: true },
    } });
    expect(result.listingsExpired).toBe(1);
  });

  it("activates a Coming Soon listing on its list date", async () => {
    vi.mocked(prisma.listingFile.findMany).mockImplementation((async (args: any) =>
      args.where.listDate ? [{ id: "l2", status: "COMING_SOON", agent: { userId: "u1" } }] : []) as any);

    const result = await runAutoStatus(NOW);

    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l2" }, data: { status: "ACTIVE" } });
    expect(result.listingsActivated).toBe(1);
  });

  it("expires a Pending transaction past close of escrow, and reopens an Expired one whose date moved out", async () => {
    vi.mocked(prisma.transactionFile.findMany).mockImplementation((async (args: any) =>
      args.where.status === "PENDING"
        ? [{ id: "t1", status: "PENDING", agent: { userId: "u1" } }]
        : [{ id: "t2", status: "EXPIRED", agent: { userId: "u2" } }]) as any);

    const result = await runAutoStatus(NOW);

    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "EXPIRED" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t2" }, data: { status: "PENDING" } });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      fileType: "TRANSACTION", transactionFileId: "t2", listingFileId: null, actorId: "u2",
      payload: { from: "EXPIRED", to: "PENDING", automatic: true },
    }) });
    expect(result).toMatchObject({ transactionsExpired: 1, transactionsReopened: 1 });
  });

  it("keeps going when one file fails, and does not count it", async () => {
    vi.mocked(prisma.transactionFile.findMany).mockImplementation((async (args: any) =>
      args.where.status === "PENDING"
        ? [{ id: "bad", status: "PENDING", agent: { userId: "u1" } }, { id: "t1", status: "PENDING", agent: { userId: "u1" } }]
        : []) as any);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("db blip"));

    const result = await runAutoStatus(NOW);

    expect(result.transactionsExpired).toBe(1);
  });
});

describe("dateDrivenStatus", () => {
  const past = "2026-09-01T00:00:00.000Z";
  const future = "2026-10-01T00:00:00.000Z";
  const L = (status: string, over: Record<string, unknown> = {}) => ({ kind: "listing" as const, status, ...over });
  const S = (status: string, over: Record<string, unknown> = {}) => ({ kind: "transaction" as const, status, transactionSide: "PURCHASE", ...over });
  const Lease = (status: string, over: Record<string, unknown> = {}) => ({ kind: "transaction" as const, status, transactionSide: "LEASE_TENANT", ...over });

  it("activates a Coming Soon listing on its list date (today counts)", () => {
    expect(dateDrivenStatus(L("COMING_SOON", { listDate: TODAY.toISOString(), expirationDate: future }), TODAY)).toBe("ACTIVE");
    expect(dateDrivenStatus(L("COMING_SOON", { listDate: future, expirationDate: future }), TODAY)).toBeNull();
  });

  it("expires an Active or Coming Soon listing after its expiration date", () => {
    expect(dateDrivenStatus(L("ACTIVE", { expirationDate: past }), TODAY)).toBe("EXPIRED");
    expect(dateDrivenStatus(L("COMING_SOON", { listDate: past, expirationDate: past }), TODAY)).toBe("EXPIRED");
  });

  it("returns an Expired listing to Active when its expiration moves out", () => {
    expect(dateDrivenStatus(L("EXPIRED", { expirationDate: future }), TODAY)).toBe("ACTIVE");
    expect(dateDrivenStatus(L("EXPIRED", { expirationDate: past }), TODAY)).toBeNull();
  });

  it("never touches an Incomplete, Under Contract or closed listing", () => {
    for (const s of ["INCOMPLETE", "ACTIVE_UNDER_CONTRACT", "WITHDRAWN", "CANCELED", "CLOSED"]) {
      expect(dateDrivenStatus(L(s, { listDate: past, expirationDate: past }), TODAY)).toBeNull();
    }
  });

  it("keys a sale on close of escrow", () => {
    expect(dateDrivenStatus(S("PENDING", { closeOfEscrow: past }), TODAY)).toBe("EXPIRED");
    expect(dateDrivenStatus(S("EXPIRED", { closeOfEscrow: future }), TODAY)).toBe("PENDING");
    expect(dateDrivenStatus(S("PENDING", { closeOfEscrow: future }), TODAY)).toBeNull();
  });

  it("keys a lease on its lease start date, not close of escrow", () => {
    expect(dateDrivenStatus(Lease("PENDING", { leaseStartDate: past, closeOfEscrow: future }), TODAY)).toBe("EXPIRED");
    expect(dateDrivenStatus(Lease("EXPIRED", { leaseStartDate: future }), TODAY)).toBe("PENDING");
    expect(dateDrivenStatus(Lease("PENDING", { closeOfEscrow: past }), TODAY)).toBeNull();
  });

  it("does nothing without the key date, or for other transaction statuses", () => {
    expect(dateDrivenStatus(S("PENDING", {}), TODAY)).toBeNull();
    for (const s of ["INCOMPLETE", "PRE_CONTRACT", "CANCELED_PENDING", "CLOSED"]) {
      expect(dateDrivenStatus(S(s, { closeOfEscrow: past }), TODAY)).toBeNull();
    }
  });
});
