import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendFileClosed } from "@/lib/email/transaction-emails";
import { changeFileStatus } from "@/lib/file-status";

const READY = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const NOT_READY = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];
const tx = (over: Record<string, unknown> = {}) => ({
  id: "f1", agentId: "a1", status: "PENDING", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603",
  checklistItems: READY, ...over,
});
const ADMIN = { userId: "admin1", role: "ADMIN" as const };
const AGENT = { userId: "u1", role: "AGENT" as const };

// resetAllMocks (not clearAllMocks): a mockRejectedValue set in one test must not leak into the next.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "f1", status: "CLOSED" } as any);
  vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "f1", status: "CLOSED" } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(prisma.agent.findUnique).mockResolvedValue({ user: { email: "a@x.com", name: "Ann Lee" } } as any);
});

describe("changeFileStatus: validation happens before any write", () => {
  it("returns 404 when the file does not exist", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r).toEqual({ ok: false, status: 404, error: "Not found" });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a move the tables do not allow", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "ARCHIVED" }) as any);
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "PENDING", actor: ADMIN });
    expect(r).toEqual({ ok: false, status: 400, error: "Cannot transition from ARCHIVED to PENDING" });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("returns 400 when closing without every required document approved", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ checklistItems: NOT_READY }) as any);
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r).toEqual({ ok: false, status: 400, error: "Cannot close: not all required documents are approved" });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });
});

describe("changeFileStatus: a successful change", () => {
  it("clears Awaiting Review when an admin changes the status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "CLOSED", awaitingReview: false },
    });
  });

  it("does not clear Awaiting Review when an agent changes the status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CANCELED_PENDING", actor: AGENT });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "CANCELED_PENDING" },
    });
  });

  it("writes extra field updates in the same update as the status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "REFERRAL_SUCCESSFUL" }) as any);
    await changeFileStatus({
      kind: "transaction", fileId: "f1", toStatus: "REFERRAL_BROKER_REVIEW", actor: ADMIN,
      extraData: { referralAmountReceived: 5000, referralCncFee: 500 },
    });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { referralAmountReceived: 5000, referralCncFee: 500, status: "REFERRAL_BROKER_REVIEW", awaitingReview: false },
    });
  });

  it("logs both the previous and the new status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: {
        fileType: "TRANSACTION", listingFileId: null, transactionFileId: "f1",
        actorId: "admin1", actorRole: "ADMIN", type: "STATUS_CHANGED",
        payload: { from: "PENDING", to: "CLOSED" },
      },
    });
  });

  it("uses the listing table and listing file for a listing", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603", checklistItems: READY } as any);
    const r = await changeFileStatus({ kind: "listing", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r.ok).toBe(true);
    expect(prisma.listingFile.update).toHaveBeenCalled();
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fileType: "LISTING", listingFileId: "f1", transactionFileId: null }),
    }));
  });
});

describe("changeFileStatus: the Closed email", () => {
  it("sends the Closed email when a file is closed", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(sendFileClosed).toHaveBeenCalledWith(expect.objectContaining({
      agentEmail: "a@x.com", agentName: "Ann Lee", fileType: "transaction", fileId: "f1",
    }));
  });

  it("does not send it for any other status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "EXPIRED", actor: ADMIN });
    expect(sendFileClosed).not.toHaveBeenCalled();
  });

  it("still succeeds, with a warning for an admin, when the email fails", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    vi.mocked(sendFileClosed).mockRejectedValue(new Error("Postmark 406"));
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r).toMatchObject({ ok: true, emailWarning: true });
  });

  it("sends no Closed email and returns no warning for a status change an agent makes", async () => {
    // An agent's moves never reach CLOSED, so no Closed email is ever attempted for them.
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE", checklistItems: READY } as any);
    const r = await changeFileStatus({ kind: "listing", fileId: "f1", toStatus: "WITHDRAWN", actor: AGENT });
    expect(r.ok).toBe(true);
    expect("emailWarning" in r).toBe(false);
    expect(sendFileClosed).not.toHaveBeenCalled();
  });
});
