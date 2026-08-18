import Link from "next/link";
import { Plus } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { remainingQuota } from "@/lib/email-quota";
import { CampaignCard } from "@/components/campaigns/CampaignCard";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session!.user as any).role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentId = role !== "ADMIN" ? ((session!.user as any).agentId as string | null) : null;
  // Unfiltered by role — an ADMIN can have their own Agent record (e.g. a
  // broker who also sends campaigns personally) and still has a real quota
  // to see, even though `agentId` above is deliberately nulled for them so
  // the campaign LIST stays brokerage-wide instead of scoped to just them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personalAgentId = (session!.user as any).agentId as string | null;

  type CampaignRow = {
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: Date;
    _count: { contacts: number };
  };

  // Independent fetches, each with its own fallback (empty list vs. hidden
  // quota line) — run concurrently via allSettled so a slow/failing query on
  // one side never delays or blanks out the other. Two async functions keep
  // each side's try/catch scoped exactly as before the parallelization.
  async function fetchCampaigns(): Promise<CampaignRow[]> {
    try {
      return await prisma.campaign.findMany({
        where: agentId ? { agentId } : {},
        include: { _count: { select: { contacts: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    } catch {
      // Show empty state on DB error
      return [];
    }
  }

  async function fetchQuotaText(): Promise<string | null> {
    if (!personalAgentId) return null;
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: personalAgentId },
        select: { monthlyEmailLimit: true, monthlyEmailsSent: true, monthlyResetAt: true },
      });
      if (!agent) return null;
      const remaining = remainingQuota(agent, new Date());
      return `${remaining} / ${agent.monthlyEmailLimit} sends left this month`;
    } catch {
      // Show the page without the quota line on DB error.
      return null;
    }
  }

  const [campaignsResult, quotaTextResult] = await Promise.allSettled([
    fetchCampaigns(),
    fetchQuotaText(),
  ]);

  const campaigns: CampaignRow[] = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];
  const quotaText: string | null = quotaTextResult.status === "fulfilled" ? quotaTextResult.value : null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Campaigns</h1>
          <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">Create and send emails or DRIP campaigns to your leads here</p>
          {quotaText && (
            <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">{quotaText}</p>
          )}
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 font-sans text-sm text-white hover:bg-[#1B1B1B]/80 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-20 text-center">
          <p className="font-sans text-sm text-[#1B1B1B]/30">Create your first email campaign</p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-5 rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#1B1B1B]/80 transition-colors"
          >
            New Campaign →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              id={c.id}
              name={c.name}
              type={c.type}
              status={c.status}
              contactCount={c._count.contacts}
              createdAt={c.createdAt.toISOString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
