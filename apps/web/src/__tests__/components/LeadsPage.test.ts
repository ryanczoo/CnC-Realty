import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    smartList: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));
vi.mock("@/components/dashboard/LeadKanban", () => ({ LeadKanban: () => null }));
vi.mock("@/components/leads/SmartListSidebar", () => ({ SmartListSidebar: () => null }));
vi.mock("@/components/leads/SmartListResults", () => ({ SmartListResults: () => null }));
vi.mock("@/components/leads/BrokerageLeadsBanner", () => ({ BrokerageLeadsBanner: () => null }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import LeadsPage from "../../app/(dashboard)/dashboard/leads/page";

describe("LeadsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes smart lists, unseen brokerage leads, and kanban leads using session.agentId, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.smartList.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.findMany).mockImplementation((args: any) => {
      // unseen-brokerage-leads query selects only id/firstName/lastName; kanban query selects more fields
      return Promise.resolve([]) as any;
    });

    await LeadsPage({ searchParams: {} });

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.smartList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-1" } })
    );
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-1", brokerageFed: true }) })
    );
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-1" } })
    );
  });

  it("does not scope by agent for ADMIN (brokerage-wide view)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", agentId: "agent-2" },
    } as any);
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);

    await LeadsPage({ searchParams: {} });

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.smartList.findMany).not.toHaveBeenCalled();
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});
