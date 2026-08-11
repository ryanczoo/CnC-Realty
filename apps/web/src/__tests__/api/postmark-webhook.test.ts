import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/postmark/route";

function authorizedRequest(event: Record<string, unknown>): Request {
  const basic = Buffer.from("hook:secret").toString("base64");
  return new Request("http://localhost:3000/api/webhooks/postmark", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${basic}`,
    },
    body: JSON.stringify(event),
  });
}

describe("POST /api/webhooks/postmark — SubscriptionChange", () => {
  beforeEach(() => {
    process.env.POSTMARK_WEBHOOK_USER = "hook";
    process.env.POSTMARK_WEBHOOK_PASSWORD = "secret";

    // mockReset, not clearAllMocks: the latter clears recorded calls but leaves
    // implementations in place, so a resolved value set inside one test leaks
    // into every test after it.
    vi.mocked(prisma.lead.findFirst).mockReset().mockResolvedValue(null as never);
    vi.mocked(prisma.lead.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.user.findFirst).mockReset().mockResolvedValue(null as never);
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.campaignContact.updateMany).mockReset().mockResolvedValue({} as never);
  });

  it("opts a bounced address out of every category, on both tables", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user_1" } as never);

    const res = await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "dead@example.com",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { campaignOptOut: true, actionPlanOptOut: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { propertyAlertOptOut: true },
    });
  });

  it("opts out on a spam complaint", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "angry@example.com",
        SuppressSending: true,
        SuppressionReason: "SpamComplaint",
      })
    );

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { campaignOptOut: true, actionPlanOptOut: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("opts out a User with no matching Lead — property-alert subscribers", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user_1" } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "saved-search@example.com",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { propertyAlertOptOut: true },
    });
  });

  it("ignores a reactivation rather than resubscribing anyone", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "back@example.com",
        SuppressSending: false,
        SuppressionReason: "ManualSuppression",
      })
    );

    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("ignores an unrecognised suppression reason", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "who@example.com",
        SuppressSending: true,
        SuppressionReason: "SomethingNew",
      })
    );

    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("ignores a suppression with no reason at all", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "who@example.com",
        SuppressSending: true,
      })
    );

    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not touch CampaignContact — SubscriptionChange is a per-person flag", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "dead@example.com",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized SubscriptionChange without writing anything", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/webhooks/postmark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          RecordType: "SubscriptionChange",
          Recipient: "dead@example.com",
          SuppressSending: true,
          SuppressionReason: "HardBounce",
        }),
      })
    );

    expect(res.status).toBe(401);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("still records a Bounce against CampaignContact — the two paths are additive", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

    await POST(
      authorizedRequest({
        RecordType: "Bounce",
        Email: "dead@example.com",
        BouncedAt: "2026-08-10T12:00:00.000Z",
      })
    );

    expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
      where: { leadId: "lead_1" },
      data: { status: "BOUNCED" },
    });
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });
});
