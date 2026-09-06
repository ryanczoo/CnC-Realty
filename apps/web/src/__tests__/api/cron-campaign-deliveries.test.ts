process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignDelivery: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
    campaign: { updateMany: vi.fn(), findMany: vi.fn() },
    agent: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { POST, GET } from "../../app/api/cron/campaign-deliveries/route";

const CRON_SECRET = "test-secret";
process.env.CRON_SECRET = CRON_SECRET;

function makeReq(auth?: string) {
  return new NextRequest("http://localhost/api/cron/campaign-deliveries", {
    method: "POST",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });
}

const AGENT = { id: "a1", monthlyEmailLimit: 200 };
const LEAD = { id: "lead1", email: "lead@example.com" };

function plainEmailDelivery(overrides: object = {}) {
  return {
    id: "d1",
    dripStepId: null,
    dueAt: new Date(),
    status: "PENDING",
    campaignContact: {
      id: "cc1",
      lead: LEAD,
      campaign: { id: "c1", agentId: "a1", agent: AGENT, subject: "Hello", body: "<p>Hi there</p>" },
    },
    dripStep: null,
    ...overrides,
  };
}

function dripStepDelivery(overrides: object = {}) {
  return {
    id: "d2",
    dripStepId: "step1",
    dueAt: new Date(),
    status: "PENDING",
    campaignContact: {
      id: "cc2",
      lead: LEAD,
      campaign: { id: "c2", agentId: "a1", agent: AGENT, subject: null, body: null },
    },
    dripStep: { id: "step1", subject: "Step subject", body: "Plain\ntext body" },
    ...overrides,
  };
}

function resetMocks() {
  vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.campaignDelivery.update).mockResolvedValue({} as any);
  vi.mocked(prisma.campaignDelivery.updateMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.campaign.updateMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
}

function setEnv() {
  process.env.POSTMARK_SERVER_TOKEN = "test-key";
  process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

describe("POST /api/cron/campaign-deliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    resetMocks();
  });

  it("returns 401 without auth", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("sends a plain scheduled email using the campaign's own subject/body", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("lead@example.com");
    expect(call.subject).toBe("Hello");
    expect(call.stream).toBe("broadcast");
    expect(call.category).toBe("campaign");
    expect(call.html).toContain("Hi there");
    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" }, data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("sends a drip step email using the step's own subject/body, escaped and br'd", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([dripStepDelivery()] as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Step subject");
    expect(call.html).toContain("Plain<br>text body");
  });

  it("leaves a delivery PENDING and reports skippedLimit when quota is exhausted", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 0 } as any); // tryConsumeEmailQuota: at limit

    const res = await POST(makeReq(CRON_SECRET));
    const body = await res.json();

    expect(body.skippedLimit).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.campaignDelivery.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" } })
    );
  });

  it("marks a delivery SKIPPED and refunds quota when the send is suppressed", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, reason: "opted_out" });
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 1 } as any) // tryConsumeEmailQuota: consumed
      .mockResolvedValueOnce({ count: 1 } as any); // refund

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);

    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" }, data: expect.objectContaining({ status: "SKIPPED" }) })
    );
    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", monthlyEmailsSent: { gt: 0 } },
      data: { monthlyEmailsSent: { decrement: 1 } },
    });
  });

  it("isolates a failing delivery so others still process", async () => {
    const failing = plainEmailDelivery({ id: "d-fail" });
    const ok = dripStepDelivery();
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([failing, ok] as any);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("postmark down"));

    const res = await POST(makeReq(CRON_SECRET));
    const body = await res.json();

    expect(body.errors).toBe(1);
    expect(body.processed).toBe(1);
    // Left PENDING, not marked ERROR: ERROR is terminal and the cron's own
    // query never re-selects it, so a transient failure must not write any
    // terminal status for this delivery — the next run picks it up again.
    // Same shape as the over-quota test above: nothing is written for its id.
    expect(prisma.campaignDelivery.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d-fail" } })
    );
    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d2" }, data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("flips a contact's status to SENT once all its deliveries are terminal", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    // No other PENDING deliveries remain for this contact.
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({ count: 1 } as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
      where: {
        id: "cc1",
        status: "PENDING",
        deliveries: { none: { status: "PENDING" } },
        NOT: { deliveries: { some: { status: "SKIPPED" } } },
      },
      data: { status: "SENT" },
    });
  });

  it("marks a contact UNSUBSCRIBED, not SENT, when it has a SKIPPED delivery", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    // The send is suppressed, so this contact's only delivery ends SKIPPED.
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, reason: "opted_out" });

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
      where: {
        id: "cc1",
        status: "PENDING",
        deliveries: { none: { status: "PENDING" } },
        AND: { deliveries: { some: { status: "SKIPPED" } } },
      },
      data: { status: "UNSUBSCRIBED" },
    });
  });

  it("guards both rollups on status PENDING so an OPENED contact is never downgraded", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    // A contact already flipped to OPENED/CLICKED by the webhook cannot match
    // either where clause, so neither rollup can write over it. Asserted on
    // the where shape rather than by simulating real Prisma filtering.
    const rollups = vi
      .mocked(prisma.campaignContact.updateMany)
      .mock.calls.map((c) => c[0] as any);
    expect(rollups).toHaveLength(2);
    for (const call of rollups) {
      expect(call.where.status).toBe("PENDING");
    }
    expect(rollups.map((c) => c.data.status).sort()).toEqual(["SENT", "UNSUBSCRIBED"]);
  });

  it("flips a SCHEDULED campaign to ACTIVE with sentAt on its first successful send", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", status: "SCHEDULED" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("does not flip a SCHEDULED campaign to ACTIVE when its only due delivery was held back by quota", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 0 } as any); // tryConsumeEmailQuota: at limit

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaign.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "c1", status: "SCHEDULED" }) })
    );
  });

  it("flips a campaign to COMPLETED once every delivery for it is terminal", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
      where: {
        id: "c1",
        status: "ACTIVE",
        contacts: { every: { deliveries: { none: { status: "PENDING" } } } },
      },
      data: { status: "COMPLETED" },
    });
  });

  it("uses the campaign's heading over subject for a plain scheduled email", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      plainEmailDelivery({
        campaignContact: {
          id: "cc1",
          lead: LEAD,
          campaign: {
            id: "c1",
            agentId: "a1",
            agent: AGENT,
            subject: "Hello",
            heading: "A Bigger Hello",
            body: "<p>Hi there</p>",
          },
        },
      }),
    ] as any);

    await POST(makeReq(CRON_SECRET));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Hello"); // literal subject unaffected
    expect(call.html).toContain("A Bigger Hello");
  });

  it("uses a drip step's heading over its subject", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      dripStepDelivery({
        dripStep: { id: "step1", subject: "Step subject", heading: "Step Heading", body: "Plain text" },
      }),
    ] as any);

    await POST(makeReq(CRON_SECRET));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Step subject");
    expect(call.html).toContain("Step Heading");
  });

  it("pre-marks opted-out deliveries SKIPPED and excludes them from the send batch", async () => {
    // The main query filters opted-out leads out at the database, so the batch
    // the route actually processes contains only the still-subscribed one.
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    // (b) The pre-mark pass resolves opted-out rows to a terminal state rather
    // than leaving them PENDING forever.
    const premark = vi.mocked(prisma.campaignDelivery.updateMany).mock.calls[0][0] as any;
    expect(premark.where).toMatchObject({
      status: "PENDING",
      campaignContact: { lead: { campaignOptOut: true } },
    });
    expect(premark.data.status).toBe("SKIPPED");
    expect(premark.data.executedAt).toBeInstanceOf(Date);

    // (a) The send batch only ever selects leads who have not opted out, so no
    // opted-out recipient can reach sendEmail — the N+1 per-recipient check in
    // the seam is no longer the thing doing the filtering.
    const query = vi.mocked(prisma.campaignDelivery.findMany).mock.calls[0][0] as any;
    expect(query.where).toMatchObject({
      status: "PENDING",
      campaignContact: { lead: { campaignOptOut: false } },
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe("lead@example.com");
  });

  it("bounds one invocation's batch so a huge backlog cannot fan out unbounded", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    const query = vi.mocked(prisma.campaignDelivery.findMany).mock.calls[0][0] as any;
    expect(query.take).toBe(500);
  });

  it("exposes GET as an alias of POST — Vercel Cron invokes scheduled routes with GET", async () => {
    expect(GET).toBe(POST);

    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    const res = await GET(
      new NextRequest("http://localhost/api/cron/campaign-deliveries", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});

describe("POST /api/cron/campaign-deliveries — env preflight", () => {
  const VARS = [
    "POSTMARK_SERVER_TOKEN",
    "POSTMARK_BROADCAST_STREAM",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ] as const;

  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    resetMocks();
    for (const v of VARS) originals[v] = process.env[v];
  });

  afterEach(() => {
    for (const v of VARS) {
      if (originals[v] === undefined) delete process.env[v];
      else process.env[v] = originals[v];
    }
  });

  it.each(VARS)("returns 500 and touches no database when %s is unset", async (name) => {
    delete process.env[name];

    const res = await POST(makeReq(CRON_SECRET));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: `${name} not configured` });

    // Fails before any state mutation, so a misconfigured deploy cannot mark
    // deliveries terminal or roll contacts/campaigns forward with nothing sent.
    expect(prisma.campaignDelivery.findMany).not.toHaveBeenCalled();
    expect(prisma.campaignDelivery.updateMany).not.toHaveBeenCalled();
    expect(prisma.campaignDelivery.update).not.toHaveBeenCalled();
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    expect(prisma.campaign.updateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
