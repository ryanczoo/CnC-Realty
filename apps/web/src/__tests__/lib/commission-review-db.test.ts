import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@cnc/database";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { update: vi.fn() },
    transactionFile: { update: vi.fn() },
    fileChecklistItem: { findMany: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));
vi.mock("@/lib/email/transaction-emails", () => ({ sendCommissionChangeRequest: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { afterCommissionSave, planCommissionReview, finishCommissionReview } from "@/lib/commission-review-db";
import { sendCommissionChangeRequest } from "@/lib/email/transaction-emails";

const AGENT = { userId: "u1", role: "AGENT" as const, name: "Ann Agent" };
const ADMIN = { userId: "admin1", role: "ADMIN" as const, name: "Ryan" };
const REVIEWED = new Date("2026-10-01T00:00:00.000Z");
const NOTHING = { data: {}, followUp: null };

const listing = (over: Record<string, unknown> = {}) => ({
  id: "lf1", propertyAddress: "12 Oak St", commissionPercent: 2.5, commissionAmount: null,
  awaitingReview: false, reviewSubmittedAt: REVIEWED, pendingCommission: null, ...over,
});
const tx = (over: Record<string, unknown> = {}) => ({
  id: "tf1", propertyAddress: "34 Elm Ave", transactionSide: "PURCHASE",
  saleCommissionPct: 2.5, saleCommissionAmount: 25000, listingCommissionPct: 3, listingCommissionAmount: null,
  salePrice: 1000000, awaitingReview: false, reviewSubmittedAt: REVIEWED, pendingCommission: null, ...over,
});
const PENDING = {
  before: { commissionPercent: 2.5, commissionAmount: null },
  changes: [{ label: "Commission", from: "2.5%", to: "2%" }],
  requestedAt: "2026-10-02T00:00:00.000Z",
};
const approved = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const unapproved = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1", awaitingReview: true } as any);
  vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1", awaitingReview: true } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(sendCommissionChangeRequest).mockResolvedValue(undefined);
});

describe("planCommissionReview - agent", () => {
  it("plans a re-flag with the old commission kept, and writes nothing itself", async () => {
    const plan = await planCommissionReview("listing", listing(), listing({ commissionPercent: 2 }), AGENT);
    expect(plan.data.awaitingReview).toBe(true);
    expect((plan.data.pendingCommission as any).before.commissionPercent).toBe(2.5);
    expect(plan.followUp).toEqual({ type: "agent", changes: [{ label: "Commission", from: "2.5%", to: "2%" }] });
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
    expect(sendCommissionChangeRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["never submitted", { reviewSubmittedAt: null }],
    ["already awaiting review", { awaitingReview: true }],
  ])("plans nothing for a file that is %s", async (_name, over) => {
    const plan = await planCommissionReview("listing", listing(over), listing({ ...over, commissionPercent: 2 }), AGENT);
    expect(plan).toEqual(NOTHING);
  });

  it("plans nothing when only the sale price changed on a %-commission file (amount differs, % same)", async () => {
    const after = tx({ salePrice: 1200000, saleCommissionAmount: 30000 });
    expect(after.saleCommissionAmount).not.toBe(tx().saleCommissionAmount);
    expect(await planCommissionReview("transaction", tx(), after, AGENT)).toEqual(NOTHING);
  });

  it("plans nothing when the commission didn't change", async () => {
    expect(await planCommissionReview("listing", listing(), listing(), AGENT)).toEqual(NOTHING);
  });
});

describe("planCommissionReview - admin", () => {
  it("plans clearing the pending change and the review flag when every required document is approved", async () => {
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue(approved as any);
    const before = listing({ awaitingReview: true, pendingCommission: PENDING });
    const plan = await planCommissionReview("listing", before, listing({ commissionPercent: 2 }), ADMIN);
    expect(plan.data.pendingCommission).toBe(Prisma.DbNull);
    expect(plan.data.awaitingReview).toBe(false);
    expect(plan.followUp).toEqual({ type: "admin", changes: PENDING.changes });
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("keeps the review flag when a required document isn't approved", async () => {
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue(unapproved as any);
    const before = tx({ awaitingReview: true, pendingCommission: PENDING });
    const plan = await planCommissionReview("transaction", before, tx({ saleCommissionPct: 2 }), ADMIN);
    expect(plan.data.pendingCommission).toBe(Prisma.DbNull);
    expect("awaitingReview" in plan.data).toBe(false);
    expect(vi.mocked(prisma.fileChecklistItem.findMany).mock.calls[0][0]).toMatchObject({ where: { transactionFileId: "tf1" } });
  });

  it("plans nothing without a pending change, or when commission wasn't touched", async () => {
    expect(await planCommissionReview("listing", listing(), listing({ commissionPercent: 2 }), ADMIN)).toEqual(NOTHING);
    const before = listing({ awaitingReview: true, pendingCommission: PENDING });
    expect(await planCommissionReview("listing", before, before, ADMIN)).toEqual(NOTHING);
  });
});

describe("finishCommissionReview", () => {
  it("emails the broker once for an agent change", async () => {
    const changes = [{ label: "Commission", from: "2.5%", to: "2%" }];
    await finishCommissionReview({ type: "agent", changes }, "listing", "lf1", listing(), AGENT);
    expect(sendCommissionChangeRequest).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendCommissionChangeRequest).mock.calls[0][0]).toMatchObject({
      fileType: "Listing", address: "12 Oak St", agentName: "Ann Agent", fileId: "lf1", changes,
    });
  });

  it("does not throw when the email fails", async () => {
    vi.mocked(sendCommissionChangeRequest).mockRejectedValue(new Error("down"));
    await expect(finishCommissionReview({ type: "agent", changes: [] }, "listing", "lf1", listing(), AGENT)).resolves.toBeUndefined();
  });

  it("logs COMMISSION_CHANGE_APPROVED for a broker decision", async () => {
    await finishCommissionReview({ type: "admin", changes: PENDING.changes }, "transaction", "tf1", tx(), ADMIN);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0]).toMatchObject({ data: {
      type: "COMMISSION_CHANGE_APPROVED", fileType: "TRANSACTION", transactionFileId: "tf1",
      actorId: "admin1", actorRole: "ADMIN", payload: { changes: PENDING.changes, viaEdit: true },
    } });
  });

  it("does nothing without a follow-up", async () => {
    await finishCommissionReview(null, "listing", "lf1", listing(), AGENT);
    expect(sendCommissionChangeRequest).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });
});

describe("afterCommissionSave (status-change branch)", () => {
  it("re-flags with a separate write, emails, and returns the written file", async () => {
    const written = await afterCommissionSave("listing", "lf1", listing(), listing({ commissionPercent: 2 }), AGENT);
    expect(prisma.listingFile.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.listingFile.update).mock.calls[0][0]).toMatchObject({ where: { id: "lf1" }, data: { awaitingReview: true } });
    expect(sendCommissionChangeRequest).toHaveBeenCalledTimes(1);
    expect(written).toEqual({ id: "lf1", awaitingReview: true });
  });

  it("uses the transaction table for transactions", async () => {
    await afterCommissionSave("transaction", "tf1", tx(), tx({ saleCommissionPct: 2 }), AGENT);
    expect(prisma.transactionFile.update).toHaveBeenCalledTimes(1);
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("returns null and writes nothing when there is nothing to do", async () => {
    expect(await afterCommissionSave("listing", "lf1", listing(), listing(), AGENT)).toBeNull();
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("lets a failed write throw, without emailing", async () => {
    vi.mocked(prisma.listingFile.update).mockRejectedValue(new Error("db"));
    await expect(afterCommissionSave("listing", "lf1", listing(), listing({ commissionPercent: 2 }), AGENT)).rejects.toThrow("db");
    expect(sendCommissionChangeRequest).not.toHaveBeenCalled();
  });
});
