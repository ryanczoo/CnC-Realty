import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { count: vi.fn() },
  },
}));
vi.mock("@/components/dashboard/DeadlineAlerts", () => ({ DeadlineAlerts: () => null }));
vi.mock("@/components/dashboard/DashboardTabs", () => ({ DashboardTabs: () => null }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import DashboardPage from "../../app/(dashboard)/dashboard/page";

describe("DashboardPage (Overview)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes lead counts using session.agentId, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);

    const element = await DashboardPage();

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.lead.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-1" }) })
    );

    const tabs = (element as any).props.children[1];
    expect(tabs.props.role).toBe("AGENT");
  });

  it("scopes an ADMIN's Overview to their own leads (the Agent section is personal)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", agentId: "agent-2" },
    } as any);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);

    await DashboardPage();

    expect(prisma.lead.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-2" }) })
    );
    expect(prisma.lead.count).not.toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("shows zeros, never the whole brokerage, when the session has no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-3", role: "ADMIN", agentId: null },
    } as any);

    await DashboardPage();

    expect(prisma.lead.count).not.toHaveBeenCalled();
  });
});
