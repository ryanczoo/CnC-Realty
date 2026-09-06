process.env.POSTMARK_SERVER_TOKEN = "test-key";
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
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
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

  it("emails the assigned agent the lead's details on the transactional stream", async () => {
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
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    await PATCH(makeRequest("agent-1"), { params: { id: "lead-1" } });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jane@example.com");
    expect(call.subject).toBe("New Lead - Jordan Lee");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jordan Lee");
    expect(call.html).toContain("jordan@example.com");
    // No overrides — the seam supplies the default noreply@ FROM and derives
    // the plain-text part from the HTML.
    expect(call.from).toBeUndefined();
    expect(call.text).toBeUndefined();
    expect(call.replyTo).toBeUndefined();
  });

  it("greets the agent by first name only, uses the welcome email's heading/body styling, and shows the photo below the header", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1",
      displayName: "Jane Agent",
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
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    await PATCH(makeRequest("agent-1"), { params: { id: "lead-1" } });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("lead-assignment-photo.jpg");
    const headingIndex = html.indexOf("You Just Got A Lead!");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">\n          Hi Jane, You Just Got A Lead!'
    );
    expect(html).not.toContain("Hi Jane Agent");
    expect(html).not.toContain("you have a new lead");
    expect(html).toContain(
      '<div style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left;">'
    );
    expect(html).toContain('<strong style="font-weight: 700;">Name:</strong>');
    expect(html).toContain('<strong style="font-weight: 700;">Email:</strong>');
    expect(html).toContain('<strong style="font-weight: 700;">Phone:</strong>');
    expect(html).toContain('<strong style="font-weight: 700;">Status:</strong>');
    expect(html).not.toContain("font-size: 15px");
  });
});
