import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PromoteButton } from "./PromoteButton";
import { AgentTitleEditor } from "./AgentTitleEditor";
import { DownloadIcaButton } from "./DownloadIcaButton";
import { formatDate } from "@/lib/utils";
import { requireAdminPage } from "@/lib/server-utils";

export const metadata = { title: "All Agents | CnC Realty Admin" };

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-[#9E8C61] text-white",
  AGENT: "bg-[#1B1B1B] text-white",
  BUYER: "bg-[#1B1B1B]/10 text-[#1B1B1B]/60",
};

export default async function AdminAgentsPage() {
  await requireAdminPage();

  type AgentRow = {
    id: string;
    slug: string;
    title: string | null;
    licenseNum: string | null;
    createdAt: Date;
    signedIcaKey: string | null;
    user: { email: string; role: string; createdAt: Date };
    _count: { leads: number };
  };

  let agents: AgentRow[] = [];

  try {
    agents = await prisma.agent.findMany({
      include: {
        user: { select: { email: true, role: true, createdAt: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">All Agents</h1>
        <Link
          href="/join"
          className="rounded-full bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          Invite Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <EmptyState message="No agents yet" />
      ) : (
        <AdminTable
          headers={["Agent Name", "Email", "Title", "License", "Leads", "Joined", "Role", "Signed ICA", "Actions"]}
        >
          {agents.map((agent) => (
            <tr
              key={agent.id}
              className="border-t border-[#1B1B1B]/5 transition-colors hover:bg-[#F2F0EF]/50"
            >
              <td className="px-4 py-3 font-medium text-[#1B1B1B]">
                <Link href={`/agents/${agent.slug}`} className="hover:underline">
                  {agent.slug}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]/70">{agent.user.email}</td>
              <td className="px-4 py-3">
                <AgentTitleEditor agentId={agent.id} currentTitle={agent.title} />
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]/60">
                {agent.licenseNum ?? <span className="text-[#1B1B1B]/30">—</span>}
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]">{agent._count.leads}</td>
              <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                {formatDate(agent.createdAt)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[agent.user.role] ?? ROLE_BADGE.BUYER}`}
                >
                  {agent.user.role}
                </span>
              </td>
              <td className="px-4 py-3">
                {agent.signedIcaKey ? (
                  <DownloadIcaButton agentId={agent.id} />
                ) : (
                  <span className="text-[#1B1B1B]/30">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {agent.user.role === "AGENT" ? (
                  <PromoteButton agentId={agent.id} />
                ) : (
                  <span className="text-[#1B1B1B]/30">—</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
