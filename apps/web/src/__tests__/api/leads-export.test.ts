import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/lead-export", () => ({ leadsToCSV: vi.fn().mockReturnValue("id,name\n1,Jane") }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn() }, agent: { findUnique: vi.fn() } },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/leads/export/route";

describe("GET /api/leads/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires ADMIN role — a non-admin agent is rejected before any lead data is read", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) as any,
    });

    const res = await GET();

    expect(requireAuth).toHaveBeenCalledWith("ADMIN");
    expect(res.status).toBe(403);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it("returns a brokerage-wide CSV for an admin, with no agent-scoping filter", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "admin-1", email: "admin@cnc.com", role: "ADMIN" } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    const callArgs = vi.mocked(prisma.lead.findMany).mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("where");
  });
});
