import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/postmark/route";

// The lookup every suppression must use: matched by address, not id, and
// case-insensitively. Nothing lowercases Lead.email on write, and Lead.email
// is not unique, so an id-based or case-sensitive match silently misses rows.
const INSENSITIVE = (email: string) => ({
  email: { equals: email, mode: "insensitive" },
});

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
    vi.mocked(prisma.lead.updateMany).mockReset().mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.user.findFirst).mockReset().mockResolvedValue(null as never);
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.campaignContact.updateMany).mockReset().mockResolvedValue({} as never);
  });

  it("opts a bounced address out of every category, on both tables", async () => {
    vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "dead@example.com",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("dead@example.com"),
      data: { campaignOptOut: true, actionPlanOptOut: true },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("dead@example.com"),
      data: { propertyAlertOptOut: true },
    });
  });

  it("flags every duplicate Lead row, not just the first", async () => {
    // Lead.email has no @unique and no creation path dedupes, so one person who
    // submitted two forms has two rows. Flagging one leaves the dead address
    // mailable through the other on the very next campaign.
    vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 2 } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "twice@example.com",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    // Matched by address so all matching rows are written in one statement.
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("twice@example.com"),
      data: { campaignOptOut: true, actionPlanOptOut: true },
    });
    // No single-row path may exist: findFirst + update would flag only one of
    // the two rows and quietly leave the other mailable.
    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("matches a mixed-case address against a lower-case stored row", async () => {
    // Postgres `=` on TEXT is case-sensitive and nothing lowercases on write,
    // so this needs both the incoming normalisation and mode: "insensitive".
    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "John@Example.COM",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("john@example.com"),
      data: { campaignOptOut: true, actionPlanOptOut: true },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("john@example.com"),
      data: { propertyAlertOptOut: true },
    });
  });

  it("opts out on a spam complaint", async () => {
    vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 1 } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "angry@example.com",
        SuppressSending: true,
        SuppressionReason: "SpamComplaint",
      })
    );

    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("angry@example.com"),
      data: { campaignOptOut: true, actionPlanOptOut: true },
    });
  });

  it("always covers the User table — property-alert subscribers", async () => {
    // The original bug: only Lead was ever queried, so a hard-bouncing
    // saved-search subscriber with no Lead row was never flagged by any path.
    vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);

    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "saved-search@example.com",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
      })
    );

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: INSENSITIVE("saved-search@example.com"),
      data: { propertyAlertOptOut: true },
    });
  });

  it("ignores a reactivation rather than resubscribing anyone", async () => {
    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "back@example.com",
        SuppressSending: false,
        SuppressionReason: "ManualSuppression",
      })
    );

    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("ignores an unrecognised suppression reason", async () => {
    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "who@example.com",
        SuppressSending: true,
        SuppressionReason: "SomethingNew",
      })
    );

    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("ignores a suppression with no reason at all", async () => {
    await POST(
      authorizedRequest({
        RecordType: "SubscriptionChange",
        Recipient: "who@example.com",
        SuppressSending: true,
      })
    );

    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("does not touch CampaignContact — SubscriptionChange is a per-person flag", async () => {
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
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
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
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });
});
