import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
  },
}));
vi.mock("@/components/leads/LeadDetailSidebarWrapper", () => ({ LeadDetailSidebarWrapper: () => null }));
vi.mock("@/components/leads/LeadProfileTabs", () => ({ LeadProfileTabs: () => null }));
vi.mock("@/components/leads/DealsSection", () => ({ DealsSection: () => null }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import LeadDetailPage from "../../app/(dashboard)/dashboard/leads/[id]/page";
import { LeadProfileTabs } from "@/components/leads/LeadProfileTabs";

// LeadDetailPage is a server component: calling it directly returns a React
// element tree (JSX is never executed, only constructed), so we walk that
// tree to find the LeadProfileTabs element and inspect the props it was
// given — rather than needing to actually render it.
function findElement(node: any, type: unknown): any {
  if (!node || typeof node !== "object") return null;
  if (node.type === type) return node;
  const children = node.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const found = findElement(child, type);
    if (found) return found;
  }
  return null;
}

const LEAD = {
  id: "lead-1",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: null,
  status: "NEW",
  source: null,
  score: null,
  priceMin: null,
  priceMax: null,
  timeframeToMove: null,
  lastContactedAt: null,
  createdAt: new Date("2026-01-01"),
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  agentId: "agent-1",
  activities: [],
  tags: [],
  tasks: [
    {
      id: "task-1",
      title: "Call about listing",
      taskType: "CALL",
      dueDate: null,
      notes: "Left a voicemail, very interested in the Elm St listing",
      done: false,
      completedAt: null,
    },
  ],
  relationshipsFrom: [],
  relationshipsTo: [],
} as any;

describe("LeadDetailPage — task notes serialization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves each task's notes field when passing tasks down to LeadProfileTabs", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD);

    const tree = await LeadDetailPage({ params: { id: "lead-1" } });
    const el = findElement(tree, LeadProfileTabs);

    expect(el.props.tasks[0].notes).toBe("Left a voicemail, very interested in the Elm St listing");
  });
});
