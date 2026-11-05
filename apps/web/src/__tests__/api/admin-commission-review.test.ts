import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@cnc/database";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));
vi.mock("@/lib/email/transaction-emails", () => ({
  sendCommissionChangeRejected: vi.fn(),
  sendCommissionChangeRequest: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendCommissionChangeRejected } from "@/lib/email/transaction-emails";
import { POST } from "../../app/api/admin/files/[fileType]/[id]/commission-review/route";

const ADMIN = { user: { id: "admin1", role: "ADMIN", name: "Ryan", agentId: null } };
const AGENT = { user: { id: "u1", role: "AGENT", name: "Ann", agentId: "a1" } };
const call = (fileType: string, body: unknown) =>
  POST(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), {
    params: { fileType, id: "f1" },
  });

const approvedItem = { isRequired: true, documents: [{ reviewStatus: "APPROVED" }] };
const openItem = { isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] };
const agentRow = { user: { email: "ann@example.com", name: "Ann Agent" } };

const LISTING_PENDING = {
  before: { commissionPercent: 2.5, commissionAmount: null },
  changes: [{ label: "Commission", from: "2.5%", to: "2%" }],
  requestedAt: "2026-10-02T00:00:00.000Z",
};
const TX_PENDING = {
  before: { saleCommissionPct: 3, saleCommissionAmount: null, listingCommissionPct: null, listingCommissionAmount: null },
  changes: [{ label: "Sale commission", from: "3%", to: "2%" }],
  requestedAt: "2026-10-02T00:00:00.000Z",
};
const listing = (over: Record<string, unknown> = {}) => ({
  id: "f1", propertyAddress: "12 Oak St", commissionPercent: 2, commissionAmount: null,
  awaitingReview: true, pendingCommission: LISTING_PENDING, checklistItems: [approvedItem], agent: agentRow, ...over,
});
const tx = (over: Record<string, unknown> = {}) => ({
  id: "f1", propertyAddress: "34 Elm Ave", transactionSide: "PURCHASE", salePrice: 500000,
  saleCommissionPct: 2, saleCommissionAmount: 10000, listingCommissionPct: null, listingCommissionAmount: null,
  awaitingReview: true, pendingCommission: TX_PENDING, checklistItems: [approvedItem], agent: agentRow, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
  vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "f1" } as any);
  vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "f1" } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(sendCommissionChangeRejected).mockResolvedValue(undefined);
});

describe("POST commission-review - errors", () => {
  it("403 for a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await call("listing", { decision: "approve" })).status).toBe(403);
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("400 for an unknown file type", async () => {
    expect((await call("deal", { decision: "approve" })).status).toBe(400);
  });

  it("400 for an unknown decision", async () => {
    expect((await call("listing", { decision: "maybe" })).status).toBe(400);
  });

  it("404 when the file is missing", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(null);
    expect((await call("listing", { decision: "approve" })).status).toBe(404);
  });

  it("400 when there is no commission change to review", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ pendingCommission: null }) as any);
    const res = await call("listing", { decision: "approve" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "There's no commission change to review" });
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it.each([[undefined], [""], ["   "]])("400 when rejecting with reason %j", async (reason) => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    const res = await call("listing", { decision: "reject", reason });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please give a reason" });
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });
});

describe("POST commission-review - approve", () => {
  it("clears the pending change and the flag when every document is approved, in one update", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    const res = await call("listing", { decision: "approve" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" } });
    expect(prisma.listingFile.update).toHaveBeenCalledTimes(1);
    expect(prisma.listingFile.update).toHaveBeenCalledWith({
      where: { id: "f1" }, data: { pendingCommission: Prisma.DbNull, awaitingReview: false },
    });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "COMMISSION_CHANGE_APPROVED", fileType: "LISTING", listingFileId: "f1",
        actorId: "admin1", actorRole: "ADMIN", payload: { changes: LISTING_PENDING.changes },
      }),
    });
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });

  it("keeps the flag when a required document is not yet approved", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ checklistItems: [openItem] }) as any);
    await call("transaction", { decision: "approve" });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" }, data: { pendingCommission: Prisma.DbNull },
    });
  });

  it("does not log the activity when the update fails", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    vi.mocked(prisma.listingFile.update).mockRejectedValue(new Error("db down"));
    await expect(call("listing", { decision: "approve" })).rejects.toThrow("db down");
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });
});

describe("POST commission-review - reject", () => {
  it("restores a listing's commission, clears the change and flag in one update, logs it, emails the agent", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    const res = await call("listing", { decision: "reject", reason: "Too low" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" } });
    expect(prisma.listingFile.update).toHaveBeenCalledTimes(1);
    expect(prisma.listingFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { commissionPercent: 2.5, commissionAmount: null, pendingCommission: Prisma.DbNull, awaitingReview: false },
    });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "COMMISSION_CHANGE_REJECTED", payload: { changes: LISTING_PENDING.changes, reason: "Too low" },
      }),
    });
    expect(sendCommissionChangeRejected).toHaveBeenCalledTimes(1);
    expect(sendCommissionChangeRejected).toHaveBeenCalledWith({
      agentEmail: "ann@example.com", agentName: "Ann Agent", fileType: "Listing",
      address: "12 Oak St", fileId: "f1", reason: "Too low", changes: LISTING_PENDING.changes,
    });
  });

  it("restores a PURCHASE transaction's percent AND recomputes the dollar amounts and GCI", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await call("transaction", { decision: "reject", reason: "Back to 3%" });
    expect(prisma.transactionFile.update).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.transactionFile.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.saleCommissionPct).toBe(3);
    expect(data.saleCommissionAmount).toBe(15000);
    expect(data.commissionGCI).toBe(15000);
    expect(data.pendingCommission).toBe(Prisma.DbNull);
    expect(data.awaitingReview).toBe(false);
    expect(sendCommissionChangeRejected).toHaveBeenCalledWith(expect.objectContaining({ fileType: "Transaction" }));
  });

  it("keeps the flag on reject when a document is still unapproved", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ checklistItems: [openItem] }) as any);
    await call("listing", { decision: "reject", reason: "No" });
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as Record<string, unknown>;
    expect("awaitingReview" in data).toBe(false);
  });

  it("reports emailWarning when the email fails, but the change still stands", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    vi.mocked(sendCommissionChangeRejected).mockRejectedValue(new Error("smtp"));
    const res = await call("listing", { decision: "reject", reason: "No" });
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" }, emailWarning: true });
    expect(prisma.fileActivity.create).toHaveBeenCalled();
  });

  it("neither logs nor emails when the update fails", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    vi.mocked(prisma.listingFile.update).mockRejectedValue(new Error("db down"));
    await expect(call("listing", { decision: "reject", reason: "No" })).rejects.toThrow("db down");
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });
});
