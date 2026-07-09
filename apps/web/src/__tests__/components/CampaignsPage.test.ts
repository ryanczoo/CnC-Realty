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

  it("scopes campaigns using session.agentId, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);

    await CampaignsPage();

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-1" } })
    );
  });

  it("shows brokerage-wide campaigns for ADMIN", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", agentId: "agent-2" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);

    await CampaignsPage();

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});
