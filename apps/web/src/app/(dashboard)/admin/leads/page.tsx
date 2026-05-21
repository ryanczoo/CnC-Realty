import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { requireAdminPage } from "@/lib/server-utils";
import { LEAD_STATUS_COLORS } from "@/lib/campaign-ui";

export const metadata = { title: "All Leads | CnC Realty Admin" };

export default async function AdminLeadsPage() {
  await requireAdminPage();

  type LeadRow = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    source: string;
    createdAt: Date;
    agent: {
      user: { email: string };
    } | null;
  };

  let leads: LeadRow[] = [];

  try {
    leads = await prisma.lead.findMany({
      include: {
        agent: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">All Leads</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">{leads.length} total leads</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState message="No leads yet" />
      ) : (
        <AdminTable
          headers={["Lead Name", "Email", "Status", "Source", "Agent", "Created"]}
        >
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-t border-[#1B1B1B]/5 transition-colors hover:bg-[#F2F0EF]/50"
            >
              <td className="px-4 py-3 font-medium text-[#1B1B1B]">
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="hover:underline"
                >
                  {lead.firstName} {lead.lastName}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]/70">{lead.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${LEAD_STATUS_COLORS[lead.status] ?? LEAD_STATUS_COLORS.NEW}`}
                >
                  {lead.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                {lead.source}
              </td>
              <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                {lead.agent?.user.email ?? (
                  <span className="text-[#1B1B1B]/30">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                {formatDate(lead.createdAt)}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
