process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileDocument: { create: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/documents/route";

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
});
