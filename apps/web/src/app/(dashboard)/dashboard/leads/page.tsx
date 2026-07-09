import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadKanban } from "@/components/dashboard/LeadKanban";
import { SmartListSidebar } from "@/components/leads/SmartListSidebar";
import { SmartListResults } from "@/components/leads/SmartListResults";
import { resolveListFilters } from "@/lib/smart-list-filters";
import { BrokerageLeadsBanner } from "@/components/leads/BrokerageLeadsBanner";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "SHOWING" | "OFFER" | "UNDER_CONTRACT" | "CLOSED" | "LOST";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { list?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role;
  const agentId = role !== "ADMIN" ? ((session!.user as any).agentId as string | null) : null;

  const [customLists, unseenBrokerageLeads] = await Promise.all([
    agentId
      ? prisma.smartList.findMany({
          where: { agentId },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, filters: true },
        })
      : Promise.resolve([]),
    agentId
      ? prisma.lead
          .findMany({
            where: { agentId, brokerageFed: true, assignmentSeenAt: null },
            select: { id: true, firstName: true, lastName: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const list = searchParams.list ?? null;
  const isValidList = list ? resolveListFilters(list, customLists) !== null : false;

  let kanbanLeads: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    createdAt: string;
  }[] = [];

  if (!list || !isValidList) {
    try {
      const leads = await prisma.lead.findMany({
        where: agentId ? { agentId } : {},
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      });
      kanbanLeads = leads.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }));
    } catch {
      // DB error — show empty Kanban
    }
  }

  return (
    <div className="-m-8 flex min-h-[calc(100vh-4rem)]">
      <SmartListSidebar customLists={customLists} />

      <div className="flex-1 overflow-auto p-8">
        <BrokerageLeadsBanner leads={unseenBrokerageLeads} />
        {list && isValidList ? (
          <SmartListResults activeList={list} customLists={customLists} />
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Leads</h1>
            </div>
            <LeadKanban initialLeads={kanbanLeads.map(l => ({ ...l, status: l.status as LeadStatus }))} />
          </>
        )}
      </div>
    </div>
  );
}
