vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignDelivery: { findMany: vi.fn(), update: vi.fn() },
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
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      { id: "d1", dueAt: new Date("2030-01-10T00:00:00.000Z") },
      { id: "d2", dueAt: new Date("2030-01-13T00:00:00.000Z") }, // 3 days after d1
    ] as any);

    const before = Date.now();
    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    const calls = vi.mocked(prisma.campaignDelivery.update).mock.calls;
    expect(calls).toHaveLength(2);
    const d1Call = calls.find((c) => (c[0] as any).where.id === "d1")![0] as any;
    const d2Call = calls.find((c) => (c[0] as any).where.id === "d2")![0] as any;

    // d1 (the earliest) becomes due essentially immediately.
    expect(d1Call.data.dueAt.getTime()).toBeGreaterThanOrEqual(before);
    // d2 keeps its original 3-day gap relative to d1's new time.
    const gapMs = d2Call.data.dueAt.getTime() - d1Call.data.dueAt.getTime();
    expect(gapMs).toBe(3 * 24 * 60 * 60 * 1000);

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "ACTIVE" }) })
    );
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
