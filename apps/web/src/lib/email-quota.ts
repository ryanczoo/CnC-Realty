import { prisma } from "@/lib/prisma";

export interface AgentQuota {
  monthlyEmailLimit: number;
  monthlyEmailsSent: number;
  monthlyResetAt: Date;
}

/** The first UTC midnight of the month strictly after `now`. A boundary hit
 * exactly on the 1st rolls to the *following* month, not the same day. */
export function nextMonthBoundary(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Pure — never writes. Used by the read-only display path (Campaigns list
 * page) and mirrors the write path's own boundary logic so the two can never
 * disagree about whether the current period has ended.
 */
export function remainingQuota(agent: AgentQuota, now: Date): number {
  if (agent.monthlyResetAt.getTime() <= now.getTime()) {
    return agent.monthlyEmailLimit;
  }
  return Math.max(0, agent.monthlyEmailLimit - agent.monthlyEmailsSent);
}

/**
 * Call once per send batch, before any sends, not once per recipient.
 * Resets the counter only if the current period has actually ended;
 * otherwise a harmless no-op (the where clause matches zero rows).
 */
export async function ensureQuotaReset(agentId: string, now: Date): Promise<void> {
  await prisma.agent.updateMany({
    where: { id: agentId, monthlyResetAt: { lte: now } },
    data: { monthlyEmailsSent: 0, monthlyResetAt: nextMonthBoundary(now) },
  });
}

/**
 * Call once per recipient about to be sent to. Atomic — never a separate
 * read followed by a write, so concurrent sends within the same batch
 * (Promise.allSettled / Promise.all) cannot race past the limit. Returns
 * true iff this call is the one that consumed the last unit of quota
 * available; false means the agent was already at their limit and this
 * send must be skipped.
 */
export async function tryConsumeEmailQuota(agentId: string, limit: number): Promise<boolean> {
  const result = await prisma.agent.updateMany({
    where: { id: agentId, monthlyEmailsSent: { lt: limit } },
    data: { monthlyEmailsSent: { increment: 1 } },
  });
  return result.count === 1;
}
