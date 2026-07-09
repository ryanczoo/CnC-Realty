import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role;
  const agentId = role !== "ADMIN" ? ((session!.user as any).agentId as string | null) : null;

  let total = 0, newThisWeek = 0, active = 0, closed = 0;

  try {
    const where = agentId ? { agentId } : {};
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
      <DashboardTabs overviewStats={{ total, newThisWeek, active, closed }} role={role} />
    </div>
  );
}
