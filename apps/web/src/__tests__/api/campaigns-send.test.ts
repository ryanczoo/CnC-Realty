import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
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
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
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

describe("POST /api/campaigns/[id]/send — send seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      id: "c1",
      agentId: "a1",
      subject: "Spring Market Update",
      body: "<p><strong>Big news</strong> this quarter.</p>",
      contacts: [{ id: "cc1", lead: { email: "lead@example.com" } }],
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({} as any);
  });

  it("sends each recipient a broadcast-stream message from the default sender", async () => {
    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("lead@example.com");
    expect(call.subject).toBe("Spring Market Update");
    expect(call.stream).toBe("broadcast");
    // No overrides — the seam supplies the default noreply@ FROM and derives
    // the plain-text part from the HTML.
    expect(call.from).toBeUndefined();
    expect(call.text).toBeUndefined();
    expect(call.replyTo).toBeUndefined();
    expect(call.attachments).toBeUndefined();
  });

  it("wraps the Tiptap body in the branded emailLayout", async () => {
    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Spring Market Update");
    expect(call.html).toContain("logo-gold.png");
    expect(call.html).toContain("<strong>Big news</strong>");
  });
});

describe("POST /api/campaigns/[id]/send — broadcast stream preflight", () => {
  let original: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    original = process.env.POSTMARK_BROADCAST_STREAM;
    delete process.env.POSTMARK_BROADCAST_STREAM;

    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      ...CAMPAIGN,
      contacts: [{ id: "cc1", lead: { email: "lead@example.com" } }],
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({} as any);
  });

  afterEach(() => {
    if (original === undefined) delete process.env.POSTMARK_BROADCAST_STREAM;
    else process.env.POSTMARK_BROADCAST_STREAM = original;
  });

  it("fails before any state mutation and does not mark the campaign sent", async () => {
    const res = await POST(request(), { params: { id: "c1" } });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "POSTMARK_BROADCAST_STREAM not configured" });

    // The whole point: a campaign must not be recorded as ACTIVE/sentAt when
    // nothing went out.
    expect(prisma.campaign.update).not.toHaveBeenCalled();
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
