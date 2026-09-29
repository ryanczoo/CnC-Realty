import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/server-utils";
import { UNASSIGNED_LEADS_WHERE } from "@/lib/unassigned-leads";
import { parsePage } from "@/lib/pagination";
import { AdminLeadsClient } from "./AdminLeadsClient";

export const metadata = { title: "All Leads | CnC Realty Admin" };

const PAGE_SIZE = 100;

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: { page?: string | string[] };
}) {
  await requireAdminPage();
  const page = parsePage(searchParams.page);

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
  let totalLeads = 0;

  try {
    [leads, totalLeads, unassignedLeads, agents] = await Promise.all([
      prisma.lead.findMany({
        include: {
          agent: { include: { user: { select: { email: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.lead.count(),
      prisma.lead.findMany({
        where: UNASSIGNED_LEADS_WHERE,
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
        take: 200,
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

  // Outside the try: redirect() works by throwing, which the catch would swallow.
  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
  if (totalPages > 0 && page > totalPages) redirect(`/admin/leads?page=${totalPages}`);

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
          <p className="mt-1 text-sm text-[#1B1B1B]/40">{totalLeads} total leads</p>
        </div>
        <a
          href="/api/leads/export"
          className="flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 bg-white px-4 py-2 text-sm text-[#1B1B1B]"
        >
          Export CSV
        </a>
      </div>

      {/* Keyed by page so a Merge selection never carries over to another page. */}
      <AdminLeadsClient
        key={page}
        page={page}
        totalPages={totalPages}
        leads={serializedLeads}
        unassignedLeads={serializedUnassigned}
        agents={agents}
      />
    </div>
  );
}
