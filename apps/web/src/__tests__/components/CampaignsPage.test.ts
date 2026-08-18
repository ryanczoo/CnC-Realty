import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    campaign: { findMany: vi.fn() },
  },
}));
vi.mock("@/components/campaigns/CampaignCard", () => ({ CampaignCard: () => null }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import CampaignsPage from "../../app/(dashboard)/dashboard/campaigns/page";

describe("CampaignsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes campaigns using session.agentId and reads that agent's quota fields", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 58,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    } as any);

    await CampaignsPage();

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-1" } })
    );
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      select: { monthlyEmailLimit: true, monthlyEmailsSent: true, monthlyResetAt: true },
    });
  });

  it("does not crash if the agent quota lookup fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agent.findUnique).mockRejectedValue(new Error("db down"));

    await expect(CampaignsPage()).resolves.toBeDefined();
  });

  it("shows brokerage-wide campaigns for ADMIN, but still shows that admin's own quota if they have an Agent record", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", agentId: "agent-2" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 0,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    } as any);

    await CampaignsPage();

    // Campaign list scoping is unaffected by this change — an admin with an
    // Agent record still sees every agent's campaigns, not just their own.
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    // But their own quota IS looked up now, using their own agentId — this
    // is the behavior that was missing before this test was updated.
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({
      where: { id: "agent-2" },
      select: { monthlyEmailLimit: true, monthlyEmailsSent: true, monthlyResetAt: true },
    });
  });

  it("skips the quota lookup for an ADMIN with no Agent record at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-3", role: "ADMIN", agentId: null },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);

    await CampaignsPage();

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
  });
});
