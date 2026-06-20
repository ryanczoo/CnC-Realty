import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{}, {}]) },
}));
vi.mock("@/lib/email", () => ({ FROM: "noreply@cncrealtygroup.com" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { update: vi.fn(), updateMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/admin/leads/[id]/assign/route";
import { POST as POST_DISMISS } from "../../app/api/leads/dismiss-brokerage-assignments/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN" } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT" } };
const AGENT = {
  id: "a1",
  displayName: "Sarah Jones",
  user: { email: "sarah@test.com" },
};
const LEAD = {
  id: "l1",
  firstName: "John",
  lastName: "Doe",
  email: "john@test.com",
  phone: null,
  status: "NEW",
  source: "WEBSITE",
  createdAt: new Date("2026-06-20T10:00:00Z"),
  agentId: "a1",
  brokerageFed: true,
};
const ASSIGN_PARAMS = { params: { id: "l1" } };

// ─── PATCH /api/admin/leads/[id]/assign ────────────────────────────────────

describe("PATCH /api/admin/leads/[id]/assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/leads/l1/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "a1" }),
    });
    const res = await PATCH(req, ASSIGN_PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 when agentId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/leads/l1/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ASSIGN_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 404 when agent does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/leads/l1/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "nonexistent" }),
    });
    const res = await PATCH(req, ASSIGN_PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when lead does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.update).mockRejectedValue(
      Object.assign(new Error("Record not found"), { code: "P2025" })
    );
    const req = new Request("http://localhost/api/admin/leads/nonexistent/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "a1" }),
    });
    const res = await PATCH(req, { params: { id: "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("assigns lead and returns 200 with brokerageFed=true", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(LEAD as any);
    const req = new Request("http://localhost/api/admin/leads/l1/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "a1" }),
    });
    const res = await PATCH(req, ASSIGN_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brokerageFed).toBe(true);
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1" },
        data: expect.objectContaining({
          agentId: "a1",
          brokerageFed: true,
          assignmentSeenAt: null,
        }),
      })
    );
  });
});

// ─── POST /api/leads/dismiss-brokerage-assignments ─────────────────────────

describe("POST /api/leads/dismiss-brokerage-assignments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST_DISMISS(new Request("http://localhost/api/leads/dismiss-brokerage-assignments", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when no Agent record exists for the user", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    const res = await POST_DISMISS(new Request("http://localhost/api/leads/dismiss-brokerage-assignments", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("sets assignmentSeenAt on unseen brokerage leads and returns dismissed count", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "a1" } as any);
    vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 3 } as any);
    const res = await POST_DISMISS(new Request("http://localhost/api/leads/dismiss-brokerage-assignments", { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dismissed).toBe(3);
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { agentId: "a1", brokerageFed: true, assignmentSeenAt: null },
      data: { assignmentSeenAt: expect.any(Date) },
    });
  });
});
