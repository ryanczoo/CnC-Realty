import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn(), delete: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";
import { DELETE } from "../../app/api/documents/[id]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const DOC = {
  id: "d1", name: "Wrong client.pdf", r2Key: "transactions/listing/l1/d1/x.pdf", uploadedByAgentId: "u1",
  reviewStatus: "APPROVED", listingFileId: "l1", transactionFileId: null,
};
const del = (body?: unknown) =>
  DELETE(
    new Request("http://localhost", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
    { params: { id: "d1" } },
  );

// Permanent delete is the broker's tool for a document that never belonged in the
// file. It is logged with a reason before the file is erased.
describe("DELETE /api/documents/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(DOC as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.fileDocument.delete).mockResolvedValue({} as any);
    vi.mocked(deleteR2Object).mockResolvedValue(undefined as any);
  });

  it("refuses an agent, even the uploader", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    const res = await del({ reason: "oops" });
    expect(res.status).toBe(403);
    expect(prisma.fileDocument.delete).not.toHaveBeenCalled();
    expect(deleteR2Object).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { reason: "   " }])("requires a reason (%j)", async (body) => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    const res = await del(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("A reason is required");
    expect(prisma.fileDocument.delete).not.toHaveBeenCalled();
  });

  it("lets the broker delete any document, logging the name and reason first", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);

    const res = await del({ reason: "  Another client's paperwork  " });

    expect(res.status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: {
      fileType: "LISTING", listingFileId: "l1", transactionFileId: null,
      actorId: "admin1", actorRole: "ADMIN", type: "DOCUMENT_DELETED",
      payload: { name: "Wrong client.pdf", documentId: "d1", reason: "Another client's paperwork" },
    } });
    expect(deleteR2Object).toHaveBeenCalledWith("transactions/listing/l1/d1/x.pdf");
    expect(prisma.fileDocument.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    const logged = vi.mocked(prisma.fileActivity.create).mock.invocationCallOrder[0];
    const erased = vi.mocked(prisma.fileDocument.delete).mock.invocationCallOrder[0];
    expect(logged).toBeLessThan(erased);
  });

  it("returns 404 for a missing document", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(null);
    expect((await del({ reason: "x" })).status).toBe(404);
  });
});
