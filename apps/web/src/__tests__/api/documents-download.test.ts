process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/r2", () => ({ getPresignedGetUrl: vi.fn().mockResolvedValue("https://r2.example/get-url") }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { GET } from "../../app/api/documents/[id]/download/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

describe("GET /api/documents/[id]/download", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets any authenticated agent download any other agent's document", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc1", r2Key: "k", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "doc1" } });
    expect(res.status).toBe(403);
    expect(getPresignedGetUrl).not.toHaveBeenCalled();
  });

  it("allows the owning agent to download", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc1", r2Key: "k", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "doc1" } });
    expect(res.status).toBe(200);
    expect(getPresignedGetUrl).toHaveBeenCalledOnce();
  });

  it("allows ADMIN regardless of who owns the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc1", r2Key: "k", listingFileId: null, transactionFileId: "t1",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "doc1" } });
    expect(res.status).toBe(200);
  });
});
