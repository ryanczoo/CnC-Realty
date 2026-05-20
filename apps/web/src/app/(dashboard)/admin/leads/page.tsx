import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTable } from "@/components/admin/AdminTable";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "All Leads | CnC Realty Admin" };

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-green-100 text-green-700",
  SHOWING: "bg-purple-100 text-purple-700",
  OFFER: "bg-orange-100 text-orange-700",
  UNDER_CONTRACT: "bg-indigo-100 text-indigo-700",
  CLOSED: "bg-[#9E8C61]/15 text-[#9E8C61]",
  LOST: "bg-[#1B1B1B]/10 text-[#1B1B1B]/50",
};

export default async function AdminLeadsPage() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role;
  if (role !== "ADMIN") redirect("/dashboard");

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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
          <p className="text-[#1B1B1B]/40">No leads yet</p>
        </div>
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
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[lead.status] ?? STATUS_BADGE.NEW}`}
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
