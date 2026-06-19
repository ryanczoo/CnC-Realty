import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { LeadDetailSidebarWrapper } from "@/components/leads/LeadDetailSidebarWrapper";
import { LeadProfileTabs } from "@/components/leads/LeadProfileTabs";
import { DealsSection } from "@/components/leads/DealsSection";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  const agent = role !== "ADMIN" ? await prisma.agent.findUnique({ where: { userId } }) : null;

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      tags: { include: { tag: true } },
      tasks: { orderBy: { createdAt: "asc" } },
      relationshipsFrom: {
        include: { toLead: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
      relationshipsTo: {
        include: { fromLead: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });

  if (!lead) notFound();
  if (agent && lead.agentId !== agent.id) notFound();

  // Serialize dates to strings for client components
  const sidebarLead = {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    source: lead.source,
    score: lead.score,
    priceMin: lead.priceMin,
    priceMax: lead.priceMax,
    timeframeToMove: lead.timeframeToMove,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    tags: lead.tags,
    relationshipsFrom: lead.relationshipsFrom.map((r) => ({
      id: r.id,
      type: r.type,
      lead: r.toLead,
    })),
    relationshipsTo: lead.relationshipsTo.map((r) => ({
      id: r.id,
      type: r.type,
      lead: r.fromLead,
    })),
  };

  const tasks = lead.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    taskType: t.taskType,
    dueDate: t.dueDate?.toISOString() ?? null,
    done: t.done,
    completedAt: t.completedAt?.toISOString() ?? null,
  }));

  // Serialize activities — ActivityFeed expects { id, type, content, createdAt: string }
  const activities = lead.activities.map((a) => ({
    id: a.id,
    type: a.type,
    content: a.content,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div>
      <Link
        href="/dashboard/leads"
        className="mb-6 inline-block font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
      >
        ← Back to Leads
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <LeadDetailSidebarWrapper lead={sidebarLead} />
        </div>

        <div className="lg:col-span-2">
          <LeadProfileTabs leadId={lead.id} activities={activities} tasks={tasks} />
          <DealsSection
            leadId={lead.id}
            leadName={`${lead.firstName} ${lead.lastName}`}
          />
        </div>
      </div>
    </div>
  );
}
