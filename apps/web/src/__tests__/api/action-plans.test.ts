import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionPlan: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    actionPlanStep: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    leadPlanEnrollment: { count: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/admin/action-plans/route";
import { PATCH, DELETE } from "../../app/api/admin/action-plans/[id]/route";
import { POST as POST_STEP } from "../../app/api/admin/action-plans/[id]/steps/route";
import { PATCH as PATCH_STEP, DELETE as DELETE_STEP } from "../../app/api/admin/action-plans/[id]/steps/[stepId]/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN" } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT" } };
const PLAN = { id: "p1", name: "7-Day Drip", description: null, isActive: true, createdAt: new Date(), _count: { steps: 2 } };
const STEP = { id: "s1", planId: "p1", stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", body: "Hello", taskTitle: null };
const PLAN_PARAMS = { params: { id: "p1" } };
const STEP_PARAMS = { params: { id: "p1", stepId: "s1" } };

describe("GET /api/admin/action-plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 for agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.actionPlan.findMany).mockResolvedValue([PLAN] as any);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns plan list for admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findMany).mockResolvedValue([PLAN] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("7-Day Drip");
  });
});

describe("POST /api/admin/action-plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a plan", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.create).mockResolvedValue({ id: "p1", name: "New Plan", description: null, isActive: true, createdAt: new Date() } as any);
    const req = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New Plan" }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing name", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/action-plans/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 409 when active enrollments exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.leadPlanEnrollment.count).mockResolvedValue(2);
    const req = new Request("http://localhost", { method: "DELETE" });
    const res = await DELETE(req, PLAN_PARAMS);
    expect(res.status).toBe(409);
  });

  it("deletes plan when no active enrollments", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.leadPlanEnrollment.count).mockResolvedValue(0);
    vi.mocked(prisma.actionPlan.delete).mockResolvedValue(PLAN as any);
    const req = new Request("http://localhost", { method: "DELETE" });
    const res = await DELETE(req, PLAN_PARAMS);
    expect(res.status).toBe(204);
  });
});

describe("POST /api/admin/action-plans/[id]/steps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for EMAIL step missing subject", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "EMAIL", body: "Hello" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 for TASK step missing taskTitle", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "TASK" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates an EMAIL step", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    vi.mocked(prisma.actionPlanStep.create).mockResolvedValue(STEP as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", body: "Hello" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/admin/action-plans/[id]/steps/[stepId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a step and returns 204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlanStep.delete).mockResolvedValue(STEP as any);
    const req = new Request("http://localhost", { method: "DELETE" });
    const res = await DELETE_STEP(req, STEP_PARAMS);
    expect(res.status).toBe(204);
  });
});

describe("PATCH /api/admin/action-plans/[id]/steps/[stepId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when patching EMAIL step to null subject without sending stepType", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlanStep.findUnique).mockResolvedValue({ ...STEP, stepType: "EMAIL" } as any);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: null }), // no stepType in body
    });
    const res = await PATCH_STEP(req, STEP_PARAMS);
    expect(res.status).toBe(400);
  });
});
