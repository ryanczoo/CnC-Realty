// Set before imports: the route signs a per-recipient unsubscribe link at
// send time, which needs both of these.
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
// Resolves a SendResult, not undefined: the route reads `.sent` off the result
// to tell a suppressed send from a delivered one.
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
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

function contact(n: number) {
  return {
    id: `contact_${n}`,
    lead: { id: `lead_${n}`, email: `lead${n}@example.com`, firstName: "A", lastName: "B" },
  };
}

const CAMPAIGN_WITH = (count: number) => ({
  ...CAMPAIGN,
  contacts: Array.from({ length: count }, (_, i) => contact(i + 1)),
});

function request() {
  return new Request("http://localhost/api/campaigns/c1/send", { method: "POST" });
}

// vi.clearAllMocks() clears recorded calls but leaves implementations — and
// queued mockResolvedValueOnce values — in place. Tests below chain Once
// values, so an unconsumed queue would leak into the next test. Reset the send
// mock explicitly and re-establish its default.
function resetSendMock() {
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ sent: true });
}

describe("POST /api/campaigns/[id]/send — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSendMock();
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
    resetSendMock();
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
    resetSendMock();
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

describe("POST /api/campaigns/[id]/send — suppressed contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSendMock();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({} as any);
  });

  it("marks a suppressed contact UNSUBSCRIBED, not SENT", async () => {
    // Two contacts; the seam suppresses the second.
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(2) as any);
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: "opted_out" });

    const res = await POST(request(), { params: { id: "c1" } });
    const body = await res.json();

    expect(body).toEqual({ sent: 1, skipped: 1, errors: 0 });
    expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["contact_2"] } },
      data: { status: "UNSUBSCRIBED" },
    });
  });

  it("accounts for every contact", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(3) as any);
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: "opted_out" })
      .mockRejectedValueOnce(new Error("postmark down"));

    const res = await POST(request(), { params: { id: "c1" } });
    const { sent, skipped, errors } = await res.json();

    // Same invariant the IDX sync asserts: nothing vanishes between fetched and
    // accounted for.
    expect(sent + skipped + errors).toBe(3);
  });

  it("excludes opted-out leads from the contact query", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(1) as any);

    await POST(request(), { params: { id: "c1" } });

    const arg = vi.mocked(prisma.campaign.findUnique).mock.calls[0][0] as any;
    expect(arg.include.contacts.where).toMatchObject({
      status: "PENDING",
      lead: { campaignOptOut: false },
    });
  });
});
