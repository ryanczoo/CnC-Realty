import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: vi.fn(), findUnique: vi.fn() },
    lead: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    activity: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    deal: { groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET as GET_ADMIN } from "../../app/api/admin/reports/route";
import { GET as GET_MY_STATS } from "../../app/api/reports/my-stats/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN", agentId: null } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT", agentId: "a1" } };
const NO_AGENT_SESSION = { user: { id: "u2", role: "AGENT", agentId: null } };

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

// ─── GET /api/admin/reports ───────────────────────────────────────────────────

describe("GET /api/admin/reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin (AGENT role)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with leaderboard, sourceBreakdown, activityVolume, speedToLead", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      { id: "a1", displayName: "Alice" } as any,
    ]);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([
      { agentId: "a1", _count: { id: 3 } } as any,
    ]);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      { lead: { agentId: "a1" }, type: "CALL" } as any,
      { lead: { agentId: "a1" }, type: "NOTE" } as any,
    ]);
    vi.mocked(prisma.activity.groupBy).mockResolvedValue([
      { type: "CALL", _count: { id: 2 } } as any,
      { type: "NOTE", _count: { id: 1 } } as any,
    ]);
    vi.mocked(prisma.deal.groupBy)
      .mockResolvedValueOnce([{ agentId: "a1", _count: { id: 1 } } as any]) // pipeline
      .mockResolvedValueOnce([{ agentId: "a1", _count: { id: 2 } } as any]); // closed
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      {
        agentId: "a1",
        createdAt: new Date("2026-06-01T09:00:00Z"),
        lastContactedAt: new Date("2026-06-01T11:00:00Z"),
      } as any,
    ]);

    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports?range=month"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("leaderboard");
    expect(body).toHaveProperty("sourceBreakdown");
    expect(body).toHaveProperty("activityVolume");
    expect(body).toHaveProperty("speedToLead");
    expect(body.leaderboard[0]).toMatchObject({
      agentId: "a1",
      displayName: "Alice",
      leadsOwned: 3,
      activitiesLogged: 2,
      dealsInPipeline: 1,
      dealsClosed: 2,
    });
  });

  it("defaults to month range when no range param", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activity.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.deal.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);

    const res = await GET_ADMIN(makeRequest("http://localhost/api/admin/reports"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("leaderboard");
  });
});

// ─── GET /api/reports/my-stats ────────────────────────────────────────────────

describe("GET /api/reports/my-stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when no Agent record exists for the user", async () => {
    vi.mocked(getServerSession).mockResolvedValue(NO_AGENT_SESSION as any);
    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with summary, sourceBreakdown, activityBreakdown for agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(5);
    vi.mocked(prisma.deal.count)
      .mockResolvedValueOnce(2)   // dealsInPipeline
      .mockResolvedValueOnce(1);  // dealsClosed
    vi.mocked(prisma.activity.count).mockResolvedValue(10);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([
      { source: "WEBSITE", _count: { id: 3 } } as any,
      { source: "REFERRAL", _count: { id: 2 } } as any,
    ]);
    vi.mocked(prisma.activity.groupBy).mockResolvedValue([
      { type: "CALL", _count: { id: 4 } } as any,
      { type: "NOTE", _count: { id: 6 } } as any,
    ]);

    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats?range=month"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toMatchObject({
      leadsThisPeriod: 5,
      activitiesLogged: 10,
      dealsInPipeline: 2,
      dealsClosed: 1,
    });
    expect(body.sourceBreakdown).toHaveLength(2);
    expect(body.activityBreakdown).toHaveLength(6); // all 6 types always present
  });

  it("returns 200 with range=week and correct structure", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);
    vi.mocked(prisma.deal.count).mockResolvedValue(0);
    vi.mocked(prisma.activity.count).mockResolvedValue(0);
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.activity.groupBy).mockResolvedValue([]);

    const res = await GET_MY_STATS(makeRequest("http://localhost/api/reports/my-stats?range=week"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("sourceBreakdown");
    expect(body).toHaveProperty("activityBreakdown");
    expect(body.activityBreakdown).toHaveLength(6);
  });
});
