process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileTask: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "../../app/api/file-tasks/[taskId]/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

describe("PATCH/DELETE /api/file-tasks/[taskId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH: forbids a non-owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "LISTING", listingFileId: "f1" } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a2" } as any);

    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ done: true }) });
    const res = await PATCH(req, { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });

  it("PATCH: allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "LISTING", listingFileId: "f1" } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.update).mockResolvedValue({ id: "t1", done: true } as any);

    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ done: true }) });
    const res = await PATCH(req, { params: { taskId: "t1" } });
    expect(res.status).toBe(200);
  });

  it("PATCH: allows ADMIN regardless of owner", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "TRANSACTION", transactionFileId: "tx1" } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.update).mockResolvedValue({ id: "t1" } as any);

    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ done: true }) });
    const res = await PATCH(req, { params: { taskId: "t1" } });
    expect(res.status).toBe(200);
  });

  it("DELETE: forbids a non-owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "LISTING", listingFileId: "f1" } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a2" } as any);

    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });
});
