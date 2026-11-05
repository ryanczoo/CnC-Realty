import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@cnc/database";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), updateMany: vi.fn() },
    transactionFile: { findUnique: vi.fn(), updateMany: vi.fn() },
    fileActivity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/email/transaction-emails", () => ({
  sendCommissionChangeRejected: vi.fn(),
  sendCommissionChangeRequest: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
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

// the file read (with its checklist and agent) first, then the re-read inside the transaction
const mockFile = (kind: "listing" | "transaction", file: unknown) =>
  vi.mocked(prisma[kind === "listing" ? "listingFile" : "transactionFile"].findUnique)
    .mockResolvedValueOnce(file as any).mockResolvedValueOnce({ id: "f1" } as any);

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
  vi.mocked(prisma.listingFile.findUnique).mockReset();
  vi.mocked(prisma.transactionFile.findUnique).mockReset();
  vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
  vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(prisma)) as any);
  vi.mocked(prisma.listingFile.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.transactionFile.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(sendCommissionChangeRejected).mockResolvedValue(undefined);
});

describe("POST commission-review - errors", () => {
  it("403 for a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await call("listing", { decision: "approve" })).status).toBe(403);
    expect(prisma.listingFile.updateMany).not.toHaveBeenCalled();
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
    mockFile("listing", listing({ pendingCommission: null }));
    const res = await call("listing", { decision: "approve" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "There's no commission change to review" });
    expect(prisma.listingFile.updateMany).not.toHaveBeenCalled();
  });

  it("400 when the stored pendingCommission is {} (not a real change)", async () => {
    mockFile("listing", listing({ pendingCommission: {} }));
    const res = await call("listing", { decision: "approve" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "There's no commission change to review" });
    expect(prisma.listingFile.updateMany).not.toHaveBeenCalled();
  });

  it.each([[undefined], [""], ["   "]])("400 when rejecting with reason %j", async (reason) => {
    mockFile("listing", listing());
    const res = await call("listing", { decision: "reject", reason });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please give a reason" });
    expect(prisma.listingFile.updateMany).not.toHaveBeenCalled();
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });
});

describe("POST commission-review - body shape", () => {
  it.each([[null], ["x"], [[]], [42]])("400 for a non-object body %j", async (body) => {
    expect((await call("listing", body)).status).toBe(400);
    expect(prisma.listingFile.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST commission-review - already decided", () => {
  it.each([["approve", {}], ["reject", { reason: "No" }]])("409 on %s when the change was already decided, with no activity and no email", async (decision, extra) => {
    mockFile("listing", listing());
    vi.mocked(prisma.listingFile.updateMany).mockResolvedValue({ count: 0 } as any);
    const res = await call("listing", { decision, ...extra });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This change was already decided" });
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });

  it("409 for a transaction too", async () => {
    mockFile("transaction", tx());
    vi.mocked(prisma.transactionFile.updateMany).mockResolvedValue({ count: 0 } as any);
    expect((await call("transaction", { decision: "approve" })).status).toBe(409);
  });
});

describe("POST commission-review - approve", () => {
  it("clears the pending change and the flag when every document is approved, in one update", async () => {
    mockFile("listing", listing());
    const res = await call("listing", { decision: "approve" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" } });
    expect(prisma.listingFile.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.listingFile.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", pendingCommission: { path: ["requestedAt"], equals: "2026-10-02T00:00:00.000Z" } }, data: { pendingCommission: Prisma.DbNull, awaitingReview: false },
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
    mockFile("transaction", tx({ checklistItems: [openItem] }));
    await call("transaction", { decision: "approve" });
    expect(prisma.transactionFile.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", pendingCommission: { path: ["requestedAt"], equals: "2026-10-02T00:00:00.000Z" } }, data: { pendingCommission: Prisma.DbNull },
    });
  });

  it("fails when the activity cannot be written, and sends no email", async () => {
    mockFile("listing", listing());
    vi.mocked(prisma.fileActivity.create).mockRejectedValue(new Error("activity down"));
    await expect(call("listing", { decision: "reject", reason: "No" })).rejects.toThrow("activity down");
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });

  it("does not log the activity when the update fails", async () => {
    mockFile("listing", listing());
    vi.mocked(prisma.listingFile.updateMany).mockRejectedValue(new Error("db down"));
    await expect(call("listing", { decision: "approve" })).rejects.toThrow("db down");
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });
});

describe("POST commission-review - reject", () => {
  it("restores a listing's commission, clears the change and flag in one update, logs it, emails the agent", async () => {
    mockFile("listing", listing());
    const res = await call("listing", { decision: "reject", reason: "Too low" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" } });
    expect(prisma.listingFile.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.listingFile.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", pendingCommission: { path: ["requestedAt"], equals: "2026-10-02T00:00:00.000Z" } },
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
    mockFile("transaction", tx());
    await call("transaction", { decision: "reject", reason: "Back to 3%" });
    expect(prisma.transactionFile.updateMany).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.transactionFile.updateMany).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.saleCommissionPct).toBe(3);
    expect(data.saleCommissionAmount).toBe(15000);
    expect(data.commissionGCI).toBe(15000);
    expect(data.pendingCommission).toBe(Prisma.DbNull);
    expect(data.awaitingReview).toBe(false);
    expect(sendCommissionChangeRejected).toHaveBeenCalledWith(expect.objectContaining({ fileType: "Transaction" }));
  });

  it("keeps the flag on reject when a document is still unapproved", async () => {
    mockFile("listing", listing({ checklistItems: [openItem] }));
    await call("listing", { decision: "reject", reason: "No" });
    const data = vi.mocked(prisma.listingFile.updateMany).mock.calls[0][0].data as Record<string, unknown>;
    expect("awaitingReview" in data).toBe(false);
  });

  it("reports emailWarning when the email fails, but the change still stands", async () => {
    mockFile("listing", listing());
    vi.mocked(sendCommissionChangeRejected).mockRejectedValue(new Error("smtp"));
    const res = await call("listing", { decision: "reject", reason: "No" });
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" }, emailWarning: true });
    expect(prisma.fileActivity.create).toHaveBeenCalled();
  });

  it.each([
    ["no agent", { agent: null }],
    ["no user on the agent", { agent: { user: null } }],
    ["no email on the user", { agent: { user: { email: "", name: "Ann" } } }],
  ])("reports emailWarning and tells Sentry when there is %s, but the change stands", async (_n, over) => {
    mockFile("listing", listing(over));
    const res = await call("listing", { decision: "reject", reason: "No" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, file: { id: "f1" }, emailWarning: true });
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).toHaveBeenCalled();
  });

  it("does not warn on approve when the agent has no email", async () => {
    mockFile("listing", listing({ agent: null }));
    expect(await (await call("listing", { decision: "approve" })).json()).toEqual({ ok: true, file: { id: "f1" } });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("neither logs nor emails when the update fails", async () => {
    mockFile("listing", listing());
    vi.mocked(prisma.listingFile.updateMany).mockRejectedValue(new Error("db down"));
    await expect(call("listing", { decision: "reject", reason: "No" })).rejects.toThrow("db down");
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
    expect(sendCommissionChangeRejected).not.toHaveBeenCalled();
  });
});
