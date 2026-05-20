import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard/StatsCard";

export const metadata = { title: "Broker Overview | CnC Realty" };

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role;
  if (role !== "ADMIN") redirect("/dashboard");

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
    </div>
  );
}
