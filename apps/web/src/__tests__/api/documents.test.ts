process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileDocument: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/documents/route";
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/documents", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets a non-owning agent attach a document to another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await POST(req({ fileType: "LISTING", fileId: "f1", name: "sneaky.pdf", r2Key: "k", r2Url: "u" }));
    expect(res.status).toBe(403);
    expect(prisma.fileDocument.create).not.toHaveBeenCalled();
  });

  it("allows the owning agent to attach a document", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "doc1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);

    const res = await POST(
      req({
        fileType: "LISTING",
        fileId: "f1",
        name: "real.pdf",
        r2Key: "transactions/listing/f1/doc123/real.pdf",
        r2Url: "transactions/listing/f1/doc123/real.pdf",
      })
    );
    expect(res.status).toBe(201);
  });

  it("rejects an r2Key that doesn't match the verified file's own key prefix", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);

    const res = await POST(
      req({
        fileType: "LISTING",
        fileId: "f1",
        name: "sneaky.pdf",
        r2Key: "transactions/listing/SOMEONE-ELSES-FILE-ID/doc123/sneaky.pdf",
        r2Url: "transactions/listing/SOMEONE-ELSES-FILE-ID/doc123/sneaky.pdf",
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.fileDocument.create).not.toHaveBeenCalled();
  });

  it("rejects an unrecognized fileType with 400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    const res = await POST(req({ fileType: "BOGUS", fileId: "f1", name: "x.pdf", r2Key: "k", r2Url: "u" }));
    expect(res.status).toBe(400);
  });

  it("marks a document uploaded without a checklist item as additional", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "doc1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);
    await POST(req({ fileType: "LISTING", fileId: "f1", checklistItemId: null, name: "pest.pdf", r2Key: "transactions/listing/f1/d/pest.pdf", r2Url: "transactions/listing/f1/d/pest.pdf" }));
    expect(vi.mocked(prisma.fileDocument.create).mock.calls[0][0].data).toMatchObject({ isAdditional: true });
  });

  it("marks a document uploaded to a checklist item as not additional", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "doc1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);
    await POST(req({ fileType: "LISTING", fileId: "f1", checklistItemId: "c1", name: "rla.pdf", r2Key: "transactions/listing/f1/d/rla.pdf", r2Url: "transactions/listing/f1/d/rla.pdf" }));
    expect(vi.mocked(prisma.fileDocument.create).mock.calls[0][0].data).toMatchObject({ isAdditional: false });
  });

  describe("replacing a rejected additional document", () => {
    const upload = (replacesDocumentId: string) =>
      POST(req({ fileType: "LISTING", fileId: "f1", checklistItemId: null, name: "pest-v2.pdf", r2Key: "transactions/listing/f1/d2/pest-v2.pdf", r2Url: "transactions/listing/f1/d2/pest-v2.pdf", replacesDocumentId }));
    const old = (over: Record<string, unknown> = {}) => ({
      id: "old1", listingFileId: "f1", transactionFileId: null, isAdditional: true, reviewStatus: "REJECTED", checklistItemId: null, ...over,
    });

    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
      vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
      vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "d2" } as any);
      vi.mocked(prisma.fileDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);
    });

    it("takes the rejected one's place: new one listed, old one moves to Unattached keeping Rejected", async () => {
      vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(old() as any);
      const res = await upload("old1");
      expect(res.status).toBe(201);
      expect(vi.mocked(prisma.fileDocument.create).mock.calls[0][0].data).toMatchObject({ isAdditional: true, checklistItemId: null });
      expect(prisma.fileDocument.update).toHaveBeenCalledWith({ where: { id: "old1" }, data: { isAdditional: false } });
    });

    it.each([
      ["isn't rejected", { reviewStatus: "PENDING_REVIEW" }],
      ["isn't an additional document", { isAdditional: false }],
      ["belongs to another file", { listingFileId: "f9" }],
    ])("refuses when the document being replaced %s", async (_label, over) => {
      vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(old(over) as any);
      expect((await upload("old1")).status).toBe(400);
      expect(prisma.fileDocument.create).not.toHaveBeenCalled();
      expect(prisma.fileDocument.update).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/documents — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };
  const body = {
    fileType: "LISTING", fileId: "f1", name: "real.pdf",
    r2Key: "transactions/listing/f1/doc123/real.pdf", r2Url: "transactions/listing/f1/doc123/real.pdf",
  };
  const marked = () =>
    new Request("http://localhost/api/documents", { method: "POST", headers: { [AGENT_VIEW_HEADER]: "1" }, body: JSON.stringify(body) });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
    vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "doc1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("refuses another agent's file with the marker, allows it without", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2", status: "ACTIVE" } as any);
    expect((await POST(marked())).status).toBe(403);
    expect(prisma.fileDocument.create).not.toHaveBeenCalled();
    expect((await POST(req(body))).status).toBe(201);
  });

  it("logs the upload as the agent's when the marker is sent", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE" } as any);
    expect((await POST(marked())).status).toBe(201);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0].data).toMatchObject({ actorRole: "AGENT", type: "DOCUMENT_UPLOADED" });
  });

  it("locks a closed file for the admin with the marker, open without", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "CLOSED" } as any);
    expect((await POST(marked())).status).toBe(403);
    expect((await POST(req(body))).status).toBe(201);
  });
});
