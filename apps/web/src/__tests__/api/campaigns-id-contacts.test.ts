vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn() },
    campaignContact: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/campaigns/[id]/contacts/route";

function request(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/campaigns/[id]/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);
  });

  it("selects only id and agentId to check ownership, not the full campaign row", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "AGENT", agentId: "a1" } }, error: null } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1" } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await POST(request({ leadIds: ["l1"] }), { params: { id: "c1" } });

    expect(prisma.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { id: true, agentId: true },
    });
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);

    const res = await POST(request({ leadIds: ["l1"] }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the campaign belongs to a different agent", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a2" } as any);

    const res = await POST(request({ leadIds: ["l1"] }), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("adds the given leads to the campaign", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1" } as any);

    const res = await POST(request({ leadIds: ["l1", "l2"] }), { params: { id: "c1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.added).toBe(2);
  });
});
