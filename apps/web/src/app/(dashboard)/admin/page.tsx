import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TransactionFileStatus } from "@prisma/client";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { requireAdminPage } from "@/lib/server-utils";

export const metadata = { title: "Broker Overview | CnC Realty" };

export default async function AdminOverviewPage() {
  await requireAdminPage();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let totalAgents = 0;
  let totalLeads = 0;
  let activeLeads = 0;
  let closedThisMonth = 0;
  let totalListingFiles = 0;
  let totalTransactionFiles = 0;

  try {
    [
      totalAgents,
      totalLeads,
      activeLeads,
      closedThisMonth,
      totalListingFiles,
      totalTransactionFiles,
    ] = await Promise.all([
      prisma.agent.count(),
      prisma.lead.count(),
      prisma.lead.count({ where: { status: { notIn: ["CLOSED", "LOST"] } } }),
      prisma.lead.count({
        where: { status: "CLOSED", updatedAt: { gte: startOfMonth } },
      }),
      prisma.listingFile.count(),
      prisma.transactionFile.count(),
    ]);
  } catch {
    // DB unreachable — show zeros
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const openTransactionsWithDeadlines = await prisma.transactionFile.findMany({
    where: {
      status: { not: TransactionFileStatus.CLOSED },
      OR: [
        { closeOfEscrow: { gte: startOfToday, lte: cutoff } },
        { inspectionDeadline: { gte: startOfToday, lte: cutoff } },
        { appraisalDeadline: { gte: startOfToday, lte: cutoff } },
        { loanApprovalDeadline: { gte: startOfToday, lte: cutoff } },
      ],
    },
    select: {
      id: true,
      propertyAddress: true,
      closeOfEscrow: true,
      inspectionDeadline: true,
      appraisalDeadline: true,
      loanApprovalDeadline: true,
      agent: { select: { user: { select: { name: true, email: true } } } },
    },
    take: 100,
  }).catch((err) => {
    console.error("[admin] Failed to load upcoming deadlines:", err);
    return [];
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Broker Overview</h1>
        <p className="mt-1 text-sm text-[#1B1B1B]/40">{today}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard label="Total Agents" value={totalAgents} />
        <StatsCard label="Total Leads" value={totalLeads} />
        <StatsCard label="Active Leads" value={activeLeads} sub="Excludes closed & lost" />
        <StatsCard label="Closed This Month" value={closedThisMonth} />
        <StatsCard label="Listing Files" value={totalListingFiles} />
        <StatsCard label="Transaction Files" value={totalTransactionFiles} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/agents"
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          View All Agents →
        </Link>
        <Link
          href="/admin/leads"
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          View All Leads →
        </Link>
        <Link
          href="/admin/transactions"
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          View All Files →
        </Link>
      </div>

      {/* Broker Supervision — Upcoming Deadlines */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-medium text-[#1B1B1B]">Upcoming Deadlines (Next 7 Days)</h2>
        {openTransactionsWithDeadlines.length === 0 ? (
          <p className="text-sm text-[#1B1B1B]/50">No deadlines in the next 7 days.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10">
            <table className="w-full text-sm">
              <thead className="bg-[#F2F0EF] text-left text-xs uppercase tracking-wider text-[#1B1B1B]/50">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Days Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B1B1B]/5 bg-white">
                {openTransactionsWithDeadlines
                  .flatMap((t) =>
                    [
                      { label: "Close of Escrow", date: t.closeOfEscrow },
                      { label: "Inspection", date: t.inspectionDeadline },
                      { label: "Appraisal", date: t.appraisalDeadline },
                      { label: "Loan Approval", date: t.loanApprovalDeadline },
                    ]
                      .filter((d) => d.date && d.date >= startOfToday && d.date <= cutoff)
                      .map((d) => ({
                        id: t.id,
                        address: t.propertyAddress,
                        agentName: t.agent?.user?.name,
                        date: d.date!,
                        label: d.label,
                      }))
                  )
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((row, idx) => {
                    const daysOut = Math.ceil((row.date.getTime() - Date.now()) / 86_400_000);
                    return (
                      <tr key={`${row.id}-${idx}`} className="hover:bg-[#F2F0EF]/50">
                        <td className="px-4 py-3 font-medium text-[#1B1B1B]">
                          <a href={`/admin/transactions/transaction/${row.id}`} className="hover:underline">
                            {row.address ?? "—"}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-[#1B1B1B]/70">
                          {row.agentName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#1B1B1B]/70">
                          {row.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-[#1B1B1B]/70">{row.label}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            daysOut <= 1 ? "bg-red-100 text-red-700" :
                            daysOut <= 3 ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `${daysOut} days`}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
