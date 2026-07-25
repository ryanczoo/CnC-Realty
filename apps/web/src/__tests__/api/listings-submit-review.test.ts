import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendSubmitForReview: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/listings/[id]/submit-review/route";

const LISTING = {
  id: "l1",
  agentId: "a1",
  propertyAddress: "123 Main St",
  checklistItems: [],
  agent: { user: { name: "Agent One" } },
};

describe("POST /api/listings/[id]/submit-review — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(LISTING as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the listing does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the listing belongs to a different agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(403);
  });

  it("allows the owning agent to submit for review", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(200);
  });

  it("allows ADMIN to submit for review on any agent's listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u3", role: "ADMIN", agentId: null } } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(200);
  });
});
