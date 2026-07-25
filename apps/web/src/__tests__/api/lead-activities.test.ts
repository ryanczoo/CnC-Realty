import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/leads/[id]/activities/route";

function request(body: object) {
  return new Request("http://localhost/api/leads/lead-1/activities", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/leads/[id]/activities — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "act1" } as any);
    vi.mocked(prisma.lead.update).mockResolvedValue({} as any);
  });

  it("returns 404 when the lead belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);

    const res = await POST(request({ content: "Called the lead" }), { params: { id: "lead-1" } });
    expect(res.status).toBe(404);
  });

  it("allows ADMIN to add an activity to any agent's lead", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u3", email: "admin@cnc.com", role: "ADMIN", agentId: null } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);

    const res = await POST(request({ content: "Called the lead" }), { params: { id: "lead-1" } });
    expect(res.status).toBe(201);
  });

  it("allows the owning agent to add an activity", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1" } as any);

    const res = await POST(request({ content: "Called the lead" }), { params: { id: "lead-1" } });
    expect(res.status).toBe(201);
  });
});
