import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { findUnique: vi.fn() },
    actionPlan: { findUnique: vi.fn() },
    leadPlanEnrollment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    leadPlanStep: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    actionPlanStep: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/leads/[id]/enrollments/route";
import { PATCH } from "../../app/api/leads/[id]/enrollments/[enrollmentId]/route";

const SESSION = { user: { id: "u1", role: "AGENT" } };
const AGENT = { id: "a1" };
const LEAD = { agentId: "a1" };
const PLAN = { id: "pl1", name: "7-Day Drip", isActive: true };
const ENROLLMENT = {
  id: "e1", leadId: "l1", planId: "pl1", agentId: "a1",
  status: "ACTIVE", enrolledAt: new Date(), pausedAt: null, pausedReason: null, completedAt: null,
  plan: { name: "7-Day Drip" },
  steps: [],
};
const PARAMS = { params: { id: "l1" } };
const ENR_PARAMS = { params: { id: "l1", enrollmentId: "e1" } };

describe("GET /api/leads/[id]/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent does not own lead", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "other" } as any);
    const res = await GET(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns enrollment list", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([ENROLLMENT] as any);
    const res = await GET(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].planName).toBe("7-Day Drip");
  });
});

describe("POST /api/leads/[id]/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when plan not found or inactive", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pl1" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 409 when already enrolled in same plan", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(ENROLLMENT as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pl1" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });

  it("creates enrollment and materializes steps", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.actionPlanStep.findMany).mockResolvedValue([
      { id: "ts1", stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", body: "Hello", taskTitle: null },
    ] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.leadPlanEnrollment.create).mockResolvedValue({ ...ENROLLMENT, id: "e2" } as any);
    vi.mocked(prisma.leadPlanStep.createMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({ ...ENROLLMENT, id: "e2", steps: [] } as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pl1" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/leads/[id]/enrollments/[enrollmentId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pauses an enrollment with MANUAL reason", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({ ...ENROLLMENT, leadId: "l1" } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    vi.mocked(prisma.leadPlanStep.updateMany).mockResolvedValue({ count: 1 } as any);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED" }),
    });
    const res = await PATCH(req, ENR_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("PAUSED");
  });
});
