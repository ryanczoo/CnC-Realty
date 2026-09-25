import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/documents/[id]/remove/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const OTHER_AGENT = { user: { id: "u2", role: "AGENT", agentId: "a2" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const doc = (over: Record<string, unknown> = {}) => ({
  id: "d1", name: "RLA.pdf", uploadedByAgentId: "u1", reviewStatus: "PENDING_REVIEW",
  checklistItemId: "c1", checklistItem: { name: "RLA — Residential Listing Agreement" },
  listingFileId: "l1", transactionFileId: null, fileType: "LISTING", ...over,
});
const remove = () => POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });

// SkySlope-style "remove from checklist": the document comes off its checklist
// item but stays in the file (Documents tab, R2) for B&P §10148 retention.
describe("POST /api/documents/[id]/remove", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ status: "ACTIVE" } as any);
    vi.mocked(prisma.fileDocument.update).mockResolvedValue({} as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.$transaction).mockImplementation((async (ops: Promise<unknown>[]) => Promise.all(ops)) as any);
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await remove()).status).toBe(401);
  });

  it("returns 404 for a missing document", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(null);
    expect((await remove()).status).toBe(404);
  });

  it("lets an agent remove their own In Review document: detached, Not Submitted, logged", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(doc() as any);

    const res = await remove();

    expect(res.status).toBe(200);
    expect(prisma.fileDocument.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { checklistItemId: null, reviewStatus: "NOT_SUBMITTED" },
    });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: {
      fileType: "LISTING", listingFileId: "l1", transactionFileId: null,
      actorId: "u1", actorRole: "AGENT", type: "DOCUMENT_REMOVED",
      payload: { name: "RLA.pdf", documentId: "d1", checklistItemName: "RLA — Residential Listing Agreement" },
    } });
  });

  it("refuses an agent removing someone else's upload", async () => {
    vi.mocked(getServerSession).mockResolvedValue(OTHER_AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(doc() as any);
    expect((await remove()).status).toBe(403);
    expect(prisma.fileDocument.update).not.toHaveBeenCalled();
  });

  it.each(["APPROVED", "REJECTED"])("refuses an agent removing a %s document", async (reviewStatus) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(doc({ reviewStatus }) as any);
    const res = await remove();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Only documents still in review can be removed");
    expect(prisma.fileDocument.update).not.toHaveBeenCalled();
  });

  it("lets the broker remove an approved document, keeping its review status", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(doc({ reviewStatus: "APPROVED", uploadedByAgentId: "u9" }) as any);

    const res = await remove();

    expect(res.status).toBe(200);
    expect(prisma.fileDocument.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { checklistItemId: null } });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorRole: "ADMIN", type: "DOCUMENT_REMOVED" }) });
  });

  it("refuses a document that isn't on a checklist item", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(doc({ checklistItemId: null, checklistItem: null }) as any);
    const res = await remove();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This document isn't on a checklist item");
  });

  it("respects the closed-file lock for agents", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(doc() as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ status: "CLOSED" } as any);
    expect((await remove()).status).toBe(403);
    expect(prisma.fileDocument.update).not.toHaveBeenCalled();
  });
});
