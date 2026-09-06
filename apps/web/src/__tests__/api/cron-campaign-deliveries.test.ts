process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignDelivery: { findMany: vi.fn(), update: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
    campaign: { updateMany: vi.fn(), findMany: vi.fn() },
    agent: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { POST } from "../../app/api/cron/campaign-deliveries/route";

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

describe("POST /api/cron/campaign-deliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.campaignDelivery.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.campaign.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
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
    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d-fail" }, data: expect.objectContaining({ status: "ERROR" }) })
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
      where: { id: "cc1", deliveries: { none: { status: "PENDING" } } },
      data: { status: "SENT" },
    });
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
});
