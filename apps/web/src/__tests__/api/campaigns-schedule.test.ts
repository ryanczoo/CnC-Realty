vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignDelivery: { createMany: vi.fn() },
    // The route materializes rows and advances the campaign's status in one
    // transaction, so the mock has to actually run the operations it is handed.
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/campaigns/[id]/schedule/route";

const AGENT_SESSION = {
  session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
  error: null,
} as any;

function request(body: object) {
  return new Request("http://localhost/api/campaigns/c1/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function draftCampaign(overrides: object = {}) {
  return {
    id: "c1",
    agentId: "a1",
    status: "DRAFT",
    type: "EMAIL",
    subject: "Hello",
    body: "<p>Hi there</p>",
    contacts: [{ id: "cc1" }],
    steps: [],
    ...overrides,
  };
}

/** A step with content, so it clears the per-step validation gate. */
function step(id: string, stepOrder: number, delayDays: number, overrides: object = {}) {
  return { id, stepOrder, delayDays, subject: `Subject ${stepOrder}`, body: "Body", ...overrides };
}

describe("POST /api/campaigns/[id]/schedule — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.createMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 403 when the campaign belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);

    const res = await POST(request({ sendNow: true }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/campaigns/[id]/schedule — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.createMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 400 when the campaign has no contacts", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign({ contacts: [] }) as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contacts/i);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when a DRIP campaign has no steps", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign({ type: "DRIP", steps: [] }) as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/steps/i);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when an EMAIL campaign has no subject or body", async () => {
    // /send already refuses this; without the same gate here a blank campaign
    // materializes and the cron sends every recipient an empty message.
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({ subject: "", body: "" }) as any
    );

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/subject and body/i);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when any DRIP step has an empty subject or body", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({
        type: "DRIP",
        steps: [step("step1", 1, 0), step("step2", 2, 3, { body: "" })],
      }) as any
    );

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/step/i);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when scheduling for later without a scheduledAt", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);

    const res = await POST(request({ sendNow: false }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when scheduledAt is in the past", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);

    const res = await POST(
      request({ sendNow: false, scheduledAt: "2020-01-01T00:00:00.000Z" }),
      { params: { id: "c1" } }
    );
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when the campaign is not DRAFT — the idempotency guard", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign({ status: "SCHEDULED" }) as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/campaigns/[id]/schedule — materialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.createMany).mockResolvedValue({ count: 1 } as any);
  });

  it("creates one delivery per contact for a plain EMAIL campaign, due at scheduledAt", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({ contacts: [{ id: "cc1" }, { id: "cc2" }] }) as any
    );

    const res = await POST(
      request({ sendNow: false, scheduledAt: "2030-01-01T09:00:00.000Z" }),
      { params: { id: "c1" } }
    );
    expect(res.status).toBe(200);

    const calls = vi.mocked(prisma.campaignDelivery.createMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[0]![0]!.data as any[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.dripStepId).toBeNull();
      expect(row.dueAt).toEqual(new Date("2030-01-01T09:00:00.000Z"));
    }

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "SCHEDULED" },
    });
  });

  it("sets status ACTIVE and sentAt when sendNow is true for a plain EMAIL campaign", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);
    const before = Date.now();

    await POST(request({ sendNow: true }), { params: { id: "c1" } });

    const call = vi.mocked(prisma.campaign.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("ACTIVE");
    expect(call.data.sentAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("computes cumulative dueAt for each DRIP step, not relative to sendNow directly", async () => {
    const startedAt = new Date("2030-06-01T00:00:00.000Z");
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({
        type: "DRIP",
        contacts: [{ id: "cc1" }],
        steps: [step("step1", 1, 0), step("step2", 2, 3), step("step3", 3, 3)],
      }) as any
    );

    await POST(
      request({ sendNow: false, scheduledAt: startedAt.toISOString() }),
      { params: { id: "c1" } }
    );

    const calls = vi.mocked(prisma.campaignDelivery.createMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[0]![0]!.data as any[];
    expect(rows).toHaveLength(3);
    const byStep = Object.fromEntries(rows.map((r) => [r.dripStepId, r.dueAt]));
    expect(byStep["step1"]).toEqual(new Date("2030-06-01T00:00:00.000Z"));
    expect(byStep["step2"]).toEqual(new Date("2030-06-04T00:00:00.000Z")); // +3 days from step1
    expect(byStep["step3"]).toEqual(new Date("2030-06-07T00:00:00.000Z")); // +3 more days from step2, not from start
  });

  it("creates one delivery per (contact × step) for a DRIP campaign with multiple contacts", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({
        type: "DRIP",
        contacts: [{ id: "cc1" }, { id: "cc2" }],
        steps: [step("step1", 1, 0), step("step2", 2, 3)],
      }) as any
    );

    await POST(request({ sendNow: true }), { params: { id: "c1" } });

    const calls = vi.mocked(prisma.campaignDelivery.createMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[0]![0]!.data as any[];
    expect(rows).toHaveLength(4); // 2 contacts × 2 steps
  });
});
