process.env.SENDGRID_API_KEY = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ session: { user: { role: "ADMIN" } }, error: null }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { update: vi.fn() },
  },
}));
vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/admin/leads/[id]/assign/route";

function makeRequest(agentId: string) {
  return new Request("http://localhost/api/admin/leads/lead-1/assign", {
    method: "PATCH",
    body: JSON.stringify({ agentId }),
  });
}

describe("PATCH /api/admin/leads/[id]/assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the assignment email's HTML", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1",
      displayName: "Jane",
      user: { email: "jane@example.com" },
    } as any);
    vi.mocked(prisma.lead.update).mockResolvedValue({
      id: "lead-1",
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      phone: "555-1234",
      status: "NEW",
      source: "WEBSITE",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      agentId: "agent-1",
      brokerageFed: true,
    } as any);
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await PATCH(makeRequest("agent-1"), { params: { id: "lead-1" } });

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.text).toContain("Jordan Lee");
    expect(call.text).toContain("jordan@example.com");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});
