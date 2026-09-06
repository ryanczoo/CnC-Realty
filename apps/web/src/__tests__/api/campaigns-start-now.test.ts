vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignDelivery: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/campaigns/[id]/start-now/route";

const AGENT_SESSION = {
  session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
  error: null,
} as any;

function request() {
  return new Request("http://localhost/api/campaigns/c1/start-now", { method: "POST" });
}

describe("POST /api/campaigns/[id]/start-now", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.updateMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 403 when the campaign belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);

    const res = await POST(request(), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the campaign is not SCHEDULED", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "ACTIVE" } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.findMany).not.toHaveBeenCalled();
  });

  it("shifts every PENDING delivery by the same delta, preserving relative spacing", async () => {
    const early = new Date("2030-01-10T00:00:00.000Z");
    const late = new Date("2030-01-13T00:00:00.000Z"); // 3 days after `early`
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      { id: "d1", dueAt: early },
      // Same dueAt as d1 — a second recipient on the same drip step. Both are
      // covered by one grouped updateMany, not one update per row.
      { id: "d1b", dueAt: new Date(early.getTime()) },
      { id: "d2", dueAt: late },
    ] as any);

    const before = Date.now();
    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    // One write per distinct dueAt (2), not one per pending row (3).
    const calls = vi.mocked(prisma.campaignDelivery.updateMany).mock.calls.map((c) => c[0] as any);
    expect(calls).toHaveLength(2);
    expect(prisma.campaignDelivery.update).not.toHaveBeenCalled();

    const earlyCall = calls.find((c) => c.where.dueAt.getTime() === early.getTime())!;
    const lateCall = calls.find((c) => c.where.dueAt.getTime() === late.getTime())!;

    // Each group is scoped to this campaign's still-PENDING rows only.
    for (const call of calls) {
      expect(call.where.status).toBe("PENDING");
      expect(call.where.campaignContact).toEqual({ campaignId: "c1" });
    }

    // The earliest becomes due essentially immediately.
    expect(earlyCall.data.dueAt.getTime()).toBeGreaterThanOrEqual(before);
    // The later group keeps its original 3-day gap relative to the new time.
    const gapMs = lateCall.data.dueAt.getTime() - earlyCall.data.dueAt.getTime();
    expect(gapMs).toBe(3 * 24 * 60 * 60 * 1000);

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "ACTIVE" }) })
    );
  });

  it("never pushes an already-overdue delivery further into the future", async () => {
    // Overdue happens for real: quota exhaustion holds deliveries back while
    // the campaign stays SCHEDULED. An unclamped positive delta would move
    // every pending row forward — the opposite of "start now."
    const overdue = new Date("2020-01-01T00:00:00.000Z");
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      { id: "d1", dueAt: overdue },
    ] as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    const call = vi.mocked(prisma.campaignDelivery.updateMany).mock.calls[0][0] as any;
    expect(call.data.dueAt.getTime()).toBeLessThanOrEqual(overdue.getTime());
  });

  it("leaves already-terminal deliveries alone", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      { id: "d1", dueAt: new Date("2030-01-10T00:00:00.000Z") },
    ] as any);

    await POST(request(), { params: { id: "c1" } });

    // The query itself only ever asks for PENDING rows — proven by asserting
    // the where clause, since the mock always returns exactly what's given.
    const query = vi.mocked(prisma.campaignDelivery.findMany).mock.calls[0][0] as any;
    expect(query.where.status).toBe("PENDING");
  });
});
