import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadKanban } from "@/components/dashboard/LeadKanban";
import { SmartListSidebar } from "@/components/leads/SmartListSidebar";
import { SmartListResults } from "@/components/leads/SmartListResults";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { list?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  const agent =
    role !== "ADMIN"
      ? await prisma.agent.findUnique({ where: { userId } })
      : null;

  const customLists = agent
    ? await prisma.smartList.findMany({
        where: { agentId: agent.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, filters: true },
      })
    : [];

  const selectedList = searchParams.list ?? null;

  let kanbanLeads: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    createdAt: string;
  }[] = [];

  if (!selectedList) {
    try {
      const leads = await prisma.lead.findMany({
        where: agent ? { agentId: agent.id } : {},
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

  const mappedLists = customLists.map((l) => ({
    id: l.id,
    name: l.name,
    filters: l.filters,
  }));

  return (
    <div className="-m-8 flex min-h-[calc(100vh-4rem)]">
      <SmartListSidebar customLists={mappedLists} />

      <div className="flex-1 overflow-auto p-8">
        {selectedList ? (
          <SmartListResults activeList={selectedList} customLists={mappedLists} />
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Leads</h1>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <LeadKanban initialLeads={kanbanLeads as any} />
          </>
        )}
      </div>
    </div>
  );
}
