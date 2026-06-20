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
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/admin/triggers/route";
import { PATCH, DELETE } from "../../app/api/admin/triggers/[id]/route";

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
