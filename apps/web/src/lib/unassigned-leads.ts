import type { Prisma } from "@cnc/database";

// The brokerage's unassigned leads, waiting for Ryan to hand them to an agent.
// Newsletter signups also have no agent, but they're subscribers, not leads
// to assign, so they're left out.
export const UNASSIGNED_LEADS_WHERE = {
  agentId: null,
  source: { not: "NEWSLETTER" },
} satisfies Prisma.LeadWhereInput;
