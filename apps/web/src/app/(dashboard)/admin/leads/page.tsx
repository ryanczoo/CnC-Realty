import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/server-utils";
import { AdminLeadsClient } from "./AdminLeadsClient";

export const metadata = { title: "All Leads | CnC Realty Admin" };

export default async function AdminLeadsPage() {
  await requireAdminPage();

  type LeadRow = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    source: string;
    createdAt: Date;
    agent: { user: { email: string } } | null;
  };

  type UnassignedRow = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    source: string;
    createdAt: Date;
  };

  type AgentRow = {
    id: string;
    displayName: string | null;
    user: { email: string };
  };

  let leads: LeadRow[] = [];
  let unassignedLeads: UnassignedRow[] = [];
  let agents: AgentRow[] = [];

  try {
    [leads, unassignedLeads, agents] = await Promise.all([
      prisma.lead.findMany({
        include: {
          agent: { include: { user: { select: { email: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.lead.findMany({
        where: { agentId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.agent.findMany({
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          user: { select: { email: true } },
        },
      }),
    ]);
  } catch {
    // DB unreachable — show empty state
  }

  const serializedLeads = leads.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    phone: l.phone,
    status: l.status,
    source: l.source,
    createdAt: l.createdAt.toISOString(),
    agentEmail: l.agent?.user.email ?? null,
  }));

  const serializedUnassigned = unassignedLeads.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    phone: l.phone,
    status: l.status,
    source: l.source,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">All Leads</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">{leads.length} total leads</p>
        </div>
        <a
          href="/api/leads/export"
          className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 font-sans text-sm text-[#1B1B1B] transition-colors hover:bg-[#F2F0EF]"
        >
          Export CSV
        </a>
      </div>

      <AdminLeadsClient
        leads={serializedLeads}
        unassignedLeads={serializedUnassigned}
        agents={agents}
      />
    </div>
  );
}
