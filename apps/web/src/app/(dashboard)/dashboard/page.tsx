import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

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
      <DashboardTabs overviewStats={{ total, newThisWeek, active, closed }} />
    </div>
  );
}
