import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendAllDocsApproved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    fileChecklistItem: { findMany: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
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

    const req = new Request("http://localhost/api/admin/documents/doc-1/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-1" } });

    expect(prisma.listingFile.update).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { status: "INCOMPLETE" },
    });
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

    expect(prisma.listingFile.update).not.toHaveBeenCalled();
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

    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });
});
