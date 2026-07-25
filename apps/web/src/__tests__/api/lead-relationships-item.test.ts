import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    leadRelationship: { deleteMany: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DELETE } from "../../app/api/leads/[id]/relationships/[relId]/route";

describe("DELETE /api/leads/[id]/relationships/[relId] — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.leadRelationship.deleteMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 404 when the lead belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);

    const res = await DELETE(new Request("http://localhost"), { params: { id: "lead-1", relId: "rel-1" } });
    expect(res.status).toBe(404);
  });

  it("allows ADMIN to remove a relationship on any agent's lead", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u3", email: "admin@cnc.com", role: "ADMIN", agentId: null } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);

    const res = await DELETE(new Request("http://localhost"), { params: { id: "lead-1", relId: "rel-1" } });
    expect(res.status).toBe(204);
  });

  it("allows the owning agent to remove a relationship", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);

    const res = await DELETE(new Request("http://localhost"), { params: { id: "lead-1", relId: "rel-1" } });
    expect(res.status).toBe(204);
  });
});
