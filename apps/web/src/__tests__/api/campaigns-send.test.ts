import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{}, {}]) },
}));
vi.mock("@/lib/email", () => ({ FROM: "noreply@cncrealtygroup.com" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/campaigns/[id]/send/route";

const CAMPAIGN = {
  id: "c1",
  agentId: "a1",
  subject: "Hello",
  body: "Hi there",
  contacts: [],
};

function request() {
  return new Request("http://localhost/api/campaigns/c1/send", { method: "POST" });
}

describe("POST /api/campaigns/[id]/send — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENDGRID_API_KEY = "test-key";
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({} as any);
  });

  it("returns 403 when the campaign belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("allows ADMIN to send any agent's campaign", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u3", email: "admin@cnc.com", role: "ADMIN", agentId: null } },
      error: null,
    } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);

    const res = await POST(request(), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("allows the owning agent to send", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);
  });
});
