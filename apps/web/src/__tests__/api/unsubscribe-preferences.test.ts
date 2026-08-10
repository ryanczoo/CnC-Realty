import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/unsubscribe/preferences/route";
import { makeUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("GET /api/unsubscribe/preferences", () => {
  // Implementations are set here, not reset via clearAllMocks, which clears
  // calls but not implementations.
  beforeEach(() => {
    vi.mocked(prisma.lead.findUnique).mockReset().mockResolvedValue({
      campaignOptOut: true,
      actionPlanOptOut: false,
    } as never);
    vi.mocked(prisma.user.findUnique).mockReset().mockResolvedValue({
      propertyAlertOptOut: false,
    } as never);
    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(prisma.user.update).mockReset();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("returns both lead categories as subscribed-or-not", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    const res = await GET(
      new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`)
    );

    expect(await res.json()).toEqual({
      kind: "lead",
      category: "campaign",
      preferences: { campaign: false, action_plan: true },
    });
  });

  it("returns only the property alert preference for a user", async () => {
    const token = makeUnsubscribeToken("user", "user_1", "property_alert");

    const res = await GET(
      new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`)
    );

    expect(await res.json()).toEqual({
      kind: "user",
      category: "property_alert",
      preferences: { property_alert: true },
    });
  });

  it("does not mutate anything on GET", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    await GET(new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`));

    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/unsubscribe/preferences?t=nonsense")
    );

    expect(res.status).toBe(400);
  });

  it("404s when a verified lead token points at a row that no longer exists", async () => {
    // The token stays valid forever, so it outlives the row it names.
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null as never);
    const token = makeUnsubscribeToken("lead", "lead_gone", "campaign");

    const res = await GET(
      new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`)
    );

    expect(res.status).toBe(404);
  });

  it("404s when a verified user token points at a row that no longer exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    const token = makeUnsubscribeToken("user", "user_gone", "property_alert");

    const res = await GET(
      new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`)
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/unsubscribe/preferences", () => {
  beforeEach(() => {
    vi.mocked(prisma.lead.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("writes both lead flags, inverting subscribed into opted-out", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    const res = await POST(
      new Request("http://localhost:3000/api/unsubscribe/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: { campaign: false, action_plan: true },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { campaignOptOut: true, actionPlanOptOut: false },
    });
  });

  it("ignores a category the recipient's table cannot receive", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    await POST(
      new Request("http://localhost:3000/api/unsubscribe/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: { campaign: false, property_alert: false },
        }),
      })
    );

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { campaignOptOut: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without touching the database", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/unsubscribe/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "nonsense",
          preferences: { campaign: false },
        }),
      })
    );

    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("is a no-op that still reports ok when nothing applicable was sent", async () => {
    // Every key was dropped as inapplicable, so there is nothing left to write.
    // Issuing an empty `update` here would be a pointless round trip.
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    const res = await POST(
      new Request("http://localhost:3000/api/unsubscribe/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: { property_alert: false },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
