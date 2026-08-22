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
    agent: { updateMany: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { POST } from "../../app/api/campaigns/[id]/send/route";

/** The category the footer link will actually opt the recipient out of. */
function footerCategory(html: string): string | undefined {
  const href = html.match(/href="([^"]+\/unsubscribe\?t=[^"]+)"/)?.[1];
  if (!href) return undefined;
  const token = new URL(href.replace(/&amp;/g, "&")).searchParams.get("t");
  return verifyUnsubscribeToken(token ?? "")?.category;
}

const CAMPAIGN = {
  id: "c1",
  agentId: "a1",
  agent: { monthlyEmailLimit: 200 },
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
// values on both of these, so an unconsumed queue would leak into whichever
// test runs next. Reset them explicitly and re-establish their defaults.
//
// updateMany's default must resolve a real `{ count }` — the route reads
// `.count` off the pre-mark pass to seed `skipped`, so `{}` would make it NaN.
function resetSeamMocks() {
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ sent: true });
  vi.mocked(prisma.campaignContact.updateMany)
    .mockReset()
    .mockResolvedValue({ count: 0 } as any);
  // Default: every quota check succeeds. ensureQuotaReset's return value is
  // never inspected by the route, and tryConsumeEmailQuota only cares about
  // count === 1, so one shared resolved value covers both call sites.
  vi.mocked(prisma.agent.updateMany).mockReset().mockResolvedValue({ count: 1 } as any);
}

describe("POST /api/campaigns/[id]/send — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSeamMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
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
    resetSeamMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      id: "c1",
      agentId: "a1",
      agent: { monthlyEmailLimit: 200 },
      subject: "Spring Market Update",
      body: "<p><strong>Big news</strong> this quarter.</p>",
      contacts: [{ id: "cc1", lead: { id: "lead_1", email: "lead@example.com" } }],
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
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
    expect(call.html).toContain("logo-black.png");
    expect(call.html).toContain("<strong>Big news</strong>");
  });

  it("names campaign in both the send category and the footer token", async () => {
    await POST(request(), { params: { id: "c1" } });

    // The category is written twice as independent string literals — once in
    // unsubscribeFooterHtml, once in sendEmail. A mismatch type-checks and
    // ships an email whose visible unsubscribe link opts the recipient out of
    // a list the message did not come from, so both halves are asserted here.
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.category).toBe("campaign");
    expect(footerCategory(call.html!)).toBe("campaign");
  });
});

describe("POST /api/campaigns/[id]/send — NEXTAUTH_URL preflight", () => {
  let original: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSeamMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    original = process.env.NEXTAUTH_URL;
    delete process.env.NEXTAUTH_URL;

    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      ...CAMPAIGN,
      contacts: [{ id: "cc1", lead: { id: "lead_1", email: "lead@example.com" } }],
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = original;
  });

  it("fails before any state mutation rather than sending a dead opt-out link", async () => {
    const res = await POST(request(), { params: { id: "c1" } });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "NEXTAUTH_URL not configured" });

    // Unset, this one does not throw the way the other three do — the URL
    // builders interpolate the literal string "undefined" and Postmark accepts
    // the send. Every message would go out successfully carrying an
    // unsubscribe link nobody can use.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/campaigns/[id]/send — broadcast stream preflight", () => {
  let original: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSeamMocks();
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

describe("POST /api/campaigns/[id]/send — missing owning agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSeamMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u3", email: "admin@cnc.com", role: "ADMIN", agentId: null } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
  });

  it("returns 400 and mutates nothing when the campaign has no owning agent", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      ...CAMPAIGN_WITH(2),
      agentId: null,
      agent: null,
    } as any);

    const res = await POST(request(), { params: { id: "c1" } });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Campaign has no owning agent" });
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    expect(prisma.agent.updateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/campaigns/[id]/send — quota charged to the campaign's agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSeamMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
  });

  it("bills quota to campaign.agentId, not the ADMIN caller's own id", async () => {
    // Campaign is owned by agent "a1"; the caller is an ADMIN with a
    // different (or null) agentId. checkOwnership lets ADMIN through
    // regardless — the bug this guards against is the route quietly reading
    // session.user.agentId instead of campaign.agentId for quota calls.
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u-admin", email: "admin@cnc.com", role: "ADMIN", agentId: "admin-own-id" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(1) as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    for (const call of vi.mocked(prisma.agent.updateMany).mock.calls) {
      const where = call[0].where as any;
      expect(where.id).toBe("a1");
      expect(where.id).not.toBe("admin-own-id");
    }
    expect(prisma.agent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "a1" }) })
    );
  });
});

describe("POST /api/campaigns/[id]/send — suppressed contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSeamMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-key";
    process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
  });

  it("marks a suppressed contact UNSUBSCRIBED, not SENT", async () => {
    // Two contacts; the seam suppresses the second.
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(2) as any);
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: "opted_out" });

    const res = await POST(request(), { params: { id: "c1" } });
    const body = await res.json();

    expect(body).toEqual({ sent: 1, skipped: 1, skippedLimit: 0, errors: 0 });
    expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["contact_2"] } },
      data: { status: "UNSUBSCRIBED" },
    });
  });

  it("accounts for every contact", async () => {
    // Derived from the fixture, not hardcoded, so resizing the fixture cannot
    // quietly turn this into a weaker assertion.
    const campaign = CAMPAIGN_WITH(3);
    const preMarkedCount = 2;

    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(campaign as any);
    // First updateMany call is the pre-mark pass.
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValueOnce({
      count: preMarkedCount,
    } as any);
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: "opted_out" })
      .mockRejectedValueOnce(new Error("postmark down"));

    const res = await POST(request(), { params: { id: "c1" } });
    const { sent, skipped, errors } = await res.json();

    // Same invariant the IDX sync asserts: nothing vanishes between fetched
    // and accounted for. Pre-marked contacts were excluded from the contact
    // query, so they are added to the fetched count rather than part of it.
    expect(sent + skipped + errors).toBe(campaign.contacts.length + preMarkedCount);
  });

  it("marks pre-existing opted-out contacts UNSUBSCRIBED and counts them as skipped", async () => {
    // The contact query filters these out, so the send loop never sees them.
    // Without the pre-mark pass they stay PENDING forever and skipped is 0 —
    // which is the common case, not an edge case.
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(1) as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValueOnce({ count: 2 } as any);

    const res = await POST(request(), { params: { id: "c1" } });

    expect(await res.json()).toEqual({ sent: 1, skipped: 2, skippedLimit: 0, errors: 0 });
    expect(prisma.campaignContact.updateMany).toHaveBeenNthCalledWith(1, {
      where: { campaignId: "c1", status: "PENDING", lead: { campaignOptOut: true } },
      data: { status: "UNSUBSCRIBED" },
    });
  });

  it("does not mark anything when the caller does not own the campaign", async () => {
    // Ordering trap: the pre-mark pass must sit behind the ownership gate, or
    // a 403 still mutates another agent's contacts.
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(2) as any);

    const res = await POST(request(), { params: { id: "c1" } });

    expect(res.status).toBe(403);
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
  });

  it("does not mark anything when the campaign is missing a subject", async () => {
    // Same trap on the validation gate: a request that 400s must not have
    // mutated state on its way to failing.
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      ...CAMPAIGN_WITH(2),
      subject: null,
    } as any);

    const res = await POST(request(), { params: { id: "c1" } });

    expect(res.status).toBe(400);
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
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

  it("skips a recipient over quota, leaves the contact PENDING, and reports skippedLimit", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(2) as any);
    // First agent.updateMany call is ensureQuotaReset (batch-level, called
    // once); the next two are tryConsumeEmailQuota, one per recipient.
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset: boundary not passed, no-op
      .mockResolvedValueOnce({ count: 1 } as any) // recipient 1: quota available
      .mockResolvedValueOnce({ count: 0 } as any); // recipient 2: at limit

    const res = await POST(request(), { params: { id: "c1" } });
    const body = await res.json();

    expect(body).toEqual({ sent: 1, skipped: 0, skippedLimit: 1, errors: 0 });
    // The over-quota contact was never sent to at all.
    expect(sendEmail).toHaveBeenCalledOnce();
    // It must not be marked UNSUBSCRIBED — it should be retried once quota resets.
    // (Narrowed from a bare `data` match: the pre-mark pass unconditionally
    // calls updateMany with this exact `data` shape for opted-out leads on
    // every request, so an unconstrained match on `data` alone would fail
    // here regardless of the quota-skip contact's own status. What this test
    // actually needs to prove is that contact_2 itself is never targeted by
    // either post-send updateMany call.)
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: expect.arrayContaining(["contact_2"]) } } })
    );
  });

  it("accounts for every contact including limit-skipped ones", async () => {
    const campaign = CAMPAIGN_WITH(3);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(campaign as any);
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 1 } as any) // recipient 1: sent
      .mockResolvedValueOnce({ count: 0 } as any) // recipient 2: over limit
      .mockResolvedValueOnce({ count: 1 } as any); // recipient 3: sent
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    const res = await POST(request(), { params: { id: "c1" } });
    const { sent, skipped, skippedLimit, errors } = await res.json();

    expect(sent + skipped + skippedLimit + errors).toBe(campaign.contacts.length);
  });

  it("checks quota once per batch (ensureQuotaReset), not once per recipient", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(3) as any);

    await POST(request(), { params: { id: "c1" } });

    // 1 ensureQuotaReset call + 3 tryConsumeEmailQuota calls (one per
    // recipient) = 4 total. Not 3 (missing the reset) and not 6 (reset
    // called redundantly per recipient).
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(4);
  });
});
