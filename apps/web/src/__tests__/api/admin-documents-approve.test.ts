import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendAllDocsApproved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => {
  const mockPrisma: any = {
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    fileChecklistItem: { findMany: vi.fn(), createMany: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  mockPrisma.$transaction = vi.fn(async (cb: any) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendAllDocsApproved } from "@/lib/email/transaction-emails";
import { POST } from "../../app/api/admin/documents/[id]/approve/route";

describe("POST /api/admin/documents/[id]/approve — PENDING_TRANSFER unlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unlocks a PENDING_TRANSFER listing file when its checklist-attached document is approved", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-1",
      fileType: "LISTING",
      listingFileId: "listing-1",
      transactionFileId: null,
      checklistItemId: "checklist-1",
      name: "signed.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-1", status: "PENDING_TRANSFER" } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.listingFile.updateMany).mockResolvedValue({ count: 1 } as any);

    const req = new Request("http://localhost/api/admin/documents/doc-1/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-1" } });

    // The unlock now also seeds a compliance checklist and clears the creation
    // sentinels in the same guarded write — see admin-documents-approve-unlock.test.ts.
    // This test stays scoped to the status flip itself.
    expect(prisma.listingFile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "listing-1", status: "PENDING_TRANSFER" },
        data: expect.objectContaining({ status: "INCOMPLETE" }),
      })
    );
  });

  it("does not unlock a file when the approved document is unattached to any checklist item", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-2",
      fileType: "LISTING",
      listingFileId: "listing-2",
      transactionFileId: null,
      checklistItemId: null,
      name: "random.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-2", status: "PENDING_TRANSFER" } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/admin/documents/doc-2/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-2" } });

    expect(prisma.listingFile.updateMany).not.toHaveBeenCalled();
  });

  it("does not touch status for a file that is not PENDING_TRANSFER", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-3",
      fileType: "TRANSACTION",
      listingFileId: null,
      transactionFileId: "tx-3",
      checklistItemId: "checklist-3",
      name: "signed.pdf",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tx-3", status: "PENDING" } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/admin/documents/doc-3/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-3" } });

    expect(prisma.transactionFile.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/documents/[id]/approve — email failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("still approves and warns the admin when the all-approved email fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-9", fileType: "TRANSACTION", listingFileId: null, transactionFileId: "tx-9", checklistItemId: "c-9", name: "signed.pdf",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tx-9", status: "PENDING", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603",
      agent: { user: { email: "a@x.com", name: "Ann" } },
    } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]); // no required items left, so the file is ready to close
    vi.mocked(sendAllDocsApproved).mockRejectedValueOnce(new Error("Postmark 406"));

    const res = await POST(new Request("http://localhost/api/admin/documents/doc-9/approve", { method: "POST" }), { params: { id: "doc-9" } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailWarning: true });
    expect(prisma.fileDocument.update).toHaveBeenCalled();
  });

  it("does not send the all-approved email when the approved document is additional", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-8", fileType: "TRANSACTION", listingFileId: null, transactionFileId: "tx-8", checklistItemId: null, isAdditional: true, name: "pest.pdf",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tx-8", status: "PENDING", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603",
      agent: { user: { email: "a@x.com", name: "Ann" } },
    } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]); // checklist already complete

    const res = await POST(new Request("http://localhost/api/admin/documents/doc-8/approve", { method: "POST" }), { params: { id: "doc-8" } });

    expect(res.status).toBe(200);
    expect(prisma.fileDocument.update).toHaveBeenCalled();
    expect(sendAllDocsApproved).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/documents/[id]/approve — Awaiting Review badge clears", () => {
  beforeEach(() => vi.clearAllMocks());

  const admin = () => vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
  const fileFields = { propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603", agent: { user: { email: "a@x.com", name: "Ann" } } };
  const call = (id: string) => POST(new Request(`http://localhost/api/admin/documents/${id}/approve`, { method: "POST" }), { params: { id } });

  it("clears awaitingReview on a listing when the last required document is approved and no commission change is pending", async () => {
    admin();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d1", fileType: "LISTING", listingFileId: "l1", transactionFileId: null, checklistItemId: "c1", name: "a.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "l1", status: "ACTIVE", pendingCommission: null, ...fileFields } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    await call("d1");

    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { awaitingReview: false } });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("clears awaitingReview on a transaction when the last required document is approved and no commission change is pending", async () => {
    admin();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d2", fileType: "TRANSACTION", listingFileId: null, transactionFileId: "t1", checklistItemId: "c1", name: "a.pdf",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", status: "PENDING", pendingCommission: null, ...fileFields } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    await call("d2");

    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { awaitingReview: false } });
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("clears the badge even when the file has no agent to email", async () => {
    admin();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d3", fileType: "LISTING", listingFileId: "l3", transactionFileId: null, checklistItemId: "c1", name: "a.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "l3", status: "ACTIVE", pendingCommission: null, ...fileFields, agent: null } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    await call("d3");

    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l3" }, data: { awaitingReview: false } });
    expect(sendAllDocsApproved).not.toHaveBeenCalled();
  });

  it("keeps the badge when a commission change is still pending", async () => {
    admin();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d4", fileType: "LISTING", listingFileId: "l4", transactionFileId: null, checklistItemId: "c1", name: "a.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "l4", status: "ACTIVE", pendingCommission: { commissionPercent: 2.5 }, ...fileFields } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    await call("d4");

    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("does not touch the badge when an additional document is approved", async () => {
    admin();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d5", fileType: "LISTING", listingFileId: "l5", transactionFileId: null, checklistItemId: null, isAdditional: true, name: "pest.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "l5", status: "ACTIVE", pendingCommission: null, ...fileFields } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    await call("d5");

    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("does not touch the badge while a required checklist item is still unapproved", async () => {
    admin();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d6", fileType: "LISTING", listingFileId: "l6", transactionFileId: null, checklistItemId: "c1", name: "a.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "l6", status: "ACTIVE", pendingCommission: null, ...fileFields } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([
      { id: "c2", isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] },
    ] as any);

    await call("d6");

    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
});
