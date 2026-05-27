import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  let total = 0, newThisWeek = 0, active = 0, closed = 0;

  try {
    const agent = role !== "ADMIN"
      ? await prisma.agent.findUnique({ where: { userId } })
      : null;

    const where = agent ? { agentId: agent.id } : {};
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    [total, newThisWeek, active, closed] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { ...where, status: { notIn: ["CLOSED", "LOST"] } } }),
      prisma.lead.count({ where: { ...where, status: "CLOSED" } }),
    ]);
  } catch {
    // Shows zeros on DB error — better than crashing
  }

  return (
    <div>
      <DeadlineAlerts />
      <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Total Leads" value={total} />
        <StatsCard label="New This Week" value={newThisWeek} />
        <StatsCard label="Active Pipeline" value={active} />
        <StatsCard label="Closed" value={closed} />
      </div>
    </div>
  );
}
