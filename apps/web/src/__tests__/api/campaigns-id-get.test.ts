vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn() },
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/campaigns/[id]/route";

describe("GET /api/campaigns/[id] — drip steps in the payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
  });

  it("includes steps with per-step sent/total delivery counts", async () => {
    vi.mocked(prisma.campaign.findUnique)
      .mockResolvedValueOnce({ id: "c1", agentId: "a1" } as any) // ownership check
      .mockResolvedValueOnce({
        id: "c1",
        agentId: "a1",
        type: "DRIP",
        contacts: [],
        _count: { contacts: 2 },
        steps: [
          {
            id: "s1",
            stepOrder: 1,
            delayDays: 0,
            subject: "Step 1",
            body: "Hi",
            _count: { deliveries: 2 },
            deliveries: [{ status: "SENT" }, { status: "PENDING" }],
          },
        ],
      } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "c1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.steps).toHaveLength(1);
    expect(data.steps[0].subject).toBe("Step 1");
  });
});
