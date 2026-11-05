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
import { afterCommissionSave } from "@/lib/commission-review-db";
import { sendCommissionChangeRequest } from "@/lib/email/transaction-emails";

const AGENT = { userId: "u1", role: "AGENT" as const, name: "Ann Agent" };
const ADMIN = { userId: "admin1", role: "ADMIN" as const, name: "Ryan" };
const REVIEWED = new Date("2026-10-01T00:00:00.000Z");

const listing = (over: Record<string, unknown> = {}) => ({
  propertyAddress: "12 Oak St", commissionPercent: 2.5, commissionAmount: null,
  awaitingReview: false, reviewSubmittedAt: REVIEWED, pendingCommission: null, ...over,
});
const tx = (over: Record<string, unknown> = {}) => ({
  propertyAddress: "34 Elm Ave", transactionSide: "LISTING",
  saleCommissionPct: 2.5, saleCommissionAmount: null, listingCommissionPct: 3, listingCommissionAmount: null,
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

describe("afterCommissionSave - agent", () => {
  it("re-flags an after-review file with the old commission kept, and emails the broker once", async () => {
    const written = await afterCommissionSave("listing", "lf1", listing(), listing({ commissionPercent: 2 }), AGENT);
    expect(prisma.listingFile.update).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;
    expect(arg.where).toEqual({ id: "lf1" });
    expect(arg.data.awaitingReview).toBe(true);
    expect(arg.data.pendingCommission.before.commissionPercent).toBe(2.5);
    expect(sendCommissionChangeRequest).toHaveBeenCalledTimes(1);
    const mail = vi.mocked(sendCommissionChangeRequest).mock.calls[0][0] as any;
    expect(mail.changes[0].to).toBe("2%");
    expect(mail).toMatchObject({ fileType: "Listing", address: "12 Oak St", agentName: "Ann Agent", fileId: "lf1" });
    expect(written).toEqual({ id: "lf1", awaitingReview: true });
  });

  it("uses the transaction table for transactions", async () => {
    const written = await afterCommissionSave("transaction", "tf1", tx(), tx({ saleCommissionPct: 2 }), AGENT);
    expect(prisma.transactionFile.update).toHaveBeenCalledTimes(1);
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
    expect(vi.mocked(sendCommissionChangeRequest).mock.calls[0][0]).toMatchObject({ fileType: "Transaction" });
    expect(written).toEqual({ id: "tf1", awaitingReview: true });
  });

  it("does nothing for a file that was never submitted for review", async () => {
    const written = await afterCommissionSave(
      "listing", "lf1", listing({ reviewSubmittedAt: null }), listing({ reviewSubmittedAt: null, commissionPercent: 2 }), AGENT,
    );
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
    expect(sendCommissionChangeRequest).not.toHaveBeenCalled();
    expect(written).toBeNull();
  });

  it("does nothing when only the sale price changed on a %-commission file", async () => {
    const written = await afterCommissionSave("transaction", "tf1", tx(), tx({ salePrice: 1200000 }), AGENT);
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect(sendCommissionChangeRequest).not.toHaveBeenCalled();
    expect(written).toBeNull();
  });

  it("does nothing when the commission didn't change", async () => {
    expect(await afterCommissionSave("listing", "lf1", listing(), listing(), AGENT)).toBeNull();
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("does nothing while the file is already awaiting review", async () => {
    const before = listing({ awaitingReview: true });
    const after = listing({ awaitingReview: true, commissionPercent: 2 });
    expect(await afterCommissionSave("listing", "lf1", before, after, AGENT)).toBeNull();
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("still returns the written file when the email fails", async () => {
    vi.mocked(sendCommissionChangeRequest).mockRejectedValue(new Error("down"));
    const written = await afterCommissionSave("listing", "lf1", listing(), listing({ commissionPercent: 2 }), AGENT);
    expect(written).toEqual({ id: "lf1", awaitingReview: true });
  });
});

describe("afterCommissionSave - admin", () => {
  it("clears the pending change and the review flag when every required document is approved", async () => {
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue(approved as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1", awaitingReview: false } as any);
    const before = listing({ awaitingReview: true, pendingCommission: PENDING });
    const written = await afterCommissionSave("listing", "lf1", before, listing({ commissionPercent: 2, awaitingReview: true }), ADMIN);
    const arg = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;
    expect(arg.data.pendingCommission).toBe(Prisma.DbNull);
    expect(arg.data.awaitingReview).toBe(false);
    expect(prisma.fileActivity.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0]).toMatchObject({ data: {
      type: "COMMISSION_CHANGE_APPROVED", fileType: "LISTING", listingFileId: "lf1",
      actorId: "admin1", actorRole: "ADMIN", payload: { changes: PENDING.changes, viaEdit: true },
    } });
    expect(written).toEqual({ id: "lf1", awaitingReview: false });
    expect(sendCommissionChangeRequest).not.toHaveBeenCalled();
  });

  it("clears the pending change but keeps the review flag when a required document isn't approved", async () => {
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue(unapproved as any);
    const before = tx({ awaitingReview: true, pendingCommission: PENDING });
    await afterCommissionSave("transaction", "tf1", before, tx({ saleCommissionPct: 2, awaitingReview: true }), ADMIN);
    const arg = vi.mocked(prisma.transactionFile.update).mock.calls[0][0] as any;
    expect(arg.data.pendingCommission).toBe(Prisma.DbNull);
    expect("awaitingReview" in arg.data).toBe(false);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0]).toMatchObject({ data: { fileType: "TRANSACTION", transactionFileId: "tf1" } });
    expect(vi.mocked(prisma.fileChecklistItem.findMany).mock.calls[0][0]).toMatchObject({ where: { transactionFileId: "tf1" } });
  });

  it("does nothing when there is no pending change", async () => {
    expect(await afterCommissionSave("listing", "lf1", listing(), listing({ commissionPercent: 2 }), ADMIN)).toBeNull();
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("does nothing when the admin save didn't touch commission", async () => {
    const before = listing({ awaitingReview: true, pendingCommission: PENDING });
    expect(await afterCommissionSave("listing", "lf1", before, before, ADMIN)).toBeNull();
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
});
