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
  const past = new Date("2026-09-01T00:00:00.000Z");
  const future = new Date("2026-10-01T00:00:00.000Z");

  it("reads candidates by status only (indexed) — never Incomplete — and lets dateDrivenStatus decide", async () => {
    await runAutoStatus(NOW);
    const lWhere = (vi.mocked(prisma.listingFile.findMany).mock.calls[0][0] as any).where;
    const tWhere = (vi.mocked(prisma.transactionFile.findMany).mock.calls[0][0] as any).where;
    expect(lWhere).toEqual({ status: { in: ["COMING_SOON", "ACTIVE", "EXPIRED"] } });
    expect(tWhere).toEqual({ status: { in: ["PENDING", "EXPIRED"] } });
  });

  it("expires, activates and reactivates listings, logging each as automatic under the agent", async () => {
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([
      { id: "l1", status: "ACTIVE", listDate: past, expirationDate: past, agent: { userId: "u1" } },
      { id: "l2", status: "COMING_SOON", listDate: past, expirationDate: future, agent: { userId: "u1" } },
      { id: "l3", status: "EXPIRED", listDate: past, expirationDate: future, agent: { userId: "u1" } },
      { id: "l4", status: "ACTIVE", listDate: past, expirationDate: future, agent: { userId: "u1" } },
    ] as any);

    const result = await runAutoStatus(NOW);

    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { status: "EXPIRED" } });
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l2" }, data: { status: "ACTIVE" } });
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l3" }, data: { status: "ACTIVE" } });
    expect(prisma.listingFile.update).toHaveBeenCalledTimes(3);
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: {
      fileType: "LISTING", listingFileId: "l1", transactionFileId: null,
      actorId: "u1", actorRole: "AGENT", type: "STATUS_CHANGED",
      payload: { from: "ACTIVE", to: "EXPIRED", automatic: true },
    } });
    expect(result).toMatchObject({ listingsExpired: 1, listingsActivated: 2 });
  });

  it("keys sales on close of escrow and leases on lease start date", async () => {
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([
      { id: "t1", status: "PENDING", transactionSide: "PURCHASE", closeOfEscrow: past, leaseStartDate: null, agent: { userId: "u1" } },
      { id: "t2", status: "EXPIRED", transactionSide: "LISTING", closeOfEscrow: future, leaseStartDate: null, agent: { userId: "u2" } },
      { id: "t3", status: "PENDING", transactionSide: "LEASE_TENANT", closeOfEscrow: null, leaseStartDate: past, agent: { userId: "u1" } },
      { id: "t4", status: "PENDING", transactionSide: "LEASE_LANDLORD", closeOfEscrow: past, leaseStartDate: future, agent: { userId: "u1" } },
    ] as any);

    const result = await runAutoStatus(NOW);

    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "EXPIRED" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t2" }, data: { status: "PENDING" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t3" }, data: { status: "EXPIRED" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ transactionsExpired: 2, transactionsReopened: 1 });
  });

  it("keeps going when one file fails, and does not count it", async () => {
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([
      { id: "bad", status: "PENDING", transactionSide: "PURCHASE", closeOfEscrow: past, agent: { userId: "u1" } },
      { id: "t1", status: "PENDING", transactionSide: "PURCHASE", closeOfEscrow: past, agent: { userId: "u1" } },
    ] as any);
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
