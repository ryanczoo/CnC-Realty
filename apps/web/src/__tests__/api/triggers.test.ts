import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trigger: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    actionPlan: { findUnique: vi.fn() },
    lead: { update: vi.fn(), findUnique: vi.fn() },
    triggerExecution: { create: vi.fn() },
    leadPlanEnrollment: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{}, {}]) },
}));
vi.mock("@/lib/email", () => ({ FROM: "noreply@cncrealtygroup.com" }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/admin/triggers/route";
import { PATCH, DELETE } from "../../app/api/admin/triggers/[id]/route";
import { PATCH as PATCH_LEAD } from "../../app/api/leads/[id]/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN" } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT" } };

const TRIGGER_ENROLL = {
  id: "t1",
  name: "Auto-qualify drip",
  statusTrigger: "QUALIFIED",
  actionType: "ENROLL_PLAN",
  actionPlanId: "p1",
  emailSubject: null,
  emailBody: null,
  isActive: true,
  createdAt: new Date("2026-06-20T10:00:00Z"),
  actionPlan: { name: "7-Day Drip" },
};

const TRIGGER_EMAIL = {
  id: "t2",
  name: "Under contract congrats",
  statusTrigger: "UNDER_CONTRACT",
  actionType: "SEND_EMAIL",
  actionPlanId: null,
  emailSubject: "Your offer was accepted!",
  emailBody: "Congratulations!",
  isActive: true,
  createdAt: new Date("2026-06-20T10:00:00Z"),
  actionPlan: null,
};

const TRIGGER_PARAMS = { params: { id: "t1" } };

// ─── GET /api/admin/triggers ──────────────────────────────────────────────────

describe("GET /api/admin/triggers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with trigger list for admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([TRIGGER_ENROLL] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Auto-qualify drip");
  });
});

// ─── POST /api/admin/triggers ─────────────────────────────────────────────────

describe("POST /api/admin/triggers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN", actionPlanId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN", actionPlanId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for ENROLL_PLAN without actionPlanId", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for SEND_EMAIL without emailSubject", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", statusTrigger: "UNDER_CONTRACT", actionType: "SEND_EMAIL", emailBody: "Body" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates ENROLL_PLAN trigger and returns 201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue({ id: "p1", name: "7-Day Drip" } as any);
    vi.mocked(prisma.trigger.create).mockResolvedValue(TRIGGER_ENROLL as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Auto-qualify drip", statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN", actionPlanId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.actionType).toBe("ENROLL_PLAN");
  });
});

// ─── PATCH /api/admin/triggers/[id] ──────────────────────────────────────────

describe("PATCH /api/admin/triggers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/triggers/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PATCH(req, TRIGGER_PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when trigger not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.update).mockRejectedValue(
      Object.assign(new Error("Not found"), { code: "P2025" })
    );
    const req = new Request("http://localhost/api/admin/triggers/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PATCH(req, TRIGGER_PARAMS);
    expect(res.status).toBe(404);
  });

  it("updates isActive and returns 200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.update).mockResolvedValue({ ...TRIGGER_ENROLL, isActive: false } as any);
    const req = new Request("http://localhost/api/admin/triggers/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PATCH(req, TRIGGER_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(false);
  });
});

// ─── DELETE /api/admin/triggers/[id] ─────────────────────────────────────────

describe("DELETE /api/admin/triggers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/admin/triggers/t1", { method: "DELETE" }), TRIGGER_PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when trigger not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.delete).mockRejectedValue(
      Object.assign(new Error("Not found"), { code: "P2025" })
    );
    const res = await DELETE(new Request("http://localhost/api/admin/triggers/t1", { method: "DELETE" }), TRIGGER_PARAMS);
    expect(res.status).toBe(404);
  });

  it("deletes trigger and returns 204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.delete).mockResolvedValue(TRIGGER_ENROLL as any);
    const res = await DELETE(new Request("http://localhost/api/admin/triggers/t1", { method: "DELETE" }), TRIGGER_PARAMS);
    expect(res.status).toBe(204);
  });
});

// ─── Trigger execution in PATCH /api/leads/[id] ───────────────────────────────

describe("Trigger execution — PATCH /api/leads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ownership check fetches the lead first; ADMIN is authorized as long as it exists.
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);
  });

  const LEAD_PARAMS = { params: { id: "l1" } };
  const LEAD_SESSION = { user: { id: "u1", role: "ADMIN" } };
  const UPDATED_LEAD = {
    id: "l1", firstName: "John", lastName: "Doe",
    email: "john@test.com", phone: null, status: "QUALIFIED",
    agentId: "a1", createdAt: new Date(), updatedAt: new Date(),
  };

  it("fires trigger when status changes to matching value", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { ...TRIGGER_ENROLL, actionPlan: { id: "p1", isActive: true, steps: [] } },
    ] as any);
    vi.mocked(prisma.triggerExecution.create).mockResolvedValue({ id: "e1" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockResolvedValue({} as any);

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.triggerExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { triggerId: "t1", leadId: "l1" } })
    );
  });

  it("skips trigger when P2002 (already fired for this lead)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { ...TRIGGER_ENROLL, actionPlan: { id: "p1", isActive: true, steps: [] } },
    ] as any);
    vi.mocked(prisma.triggerExecution.create).mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" })
    );

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    // PATCH still succeeds even when trigger is skipped
    expect(res.status).toBe(200);
    // enrollment transaction should NOT have been called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not enter trigger block when status not in body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue({ ...UPDATED_LEAD, status: "QUALIFIED" } as any);

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Updated notes" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.trigger.findMany).not.toHaveBeenCalled();
  });

  it("PATCH returns 200 even if trigger execution block throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockRejectedValue(new Error("DB failure"));

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    expect(res.status).toBe(200);
  });
});
