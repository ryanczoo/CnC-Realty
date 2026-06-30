import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

const AGENT_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/settings", label: "Settings" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/agents", label: "All Agents" },
  { href: "/admin/leads", label: "All Leads" },
  { href: "/admin/transactions", label: "All Files" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/action-plans", label: "Action Plans" },
  { href: "/admin/settings/checklists", label: "Checklists" },
  { href: "/admin/settings/tags", label: "Tags" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any).role;
  const isAdmin = role === "ADMIN";

  return (
    <div className="flex min-h-screen bg-[#F2F0EF] pt-16">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-4 py-6">
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">Agent</p>
        <div className="mb-2 border-t border-[#1B1B1B]/10" />
        <nav className="flex flex-1 flex-col gap-1">
          {AGENT_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 font-sans text-sm font-light text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
            >
              {label}
            </Link>
          ))}
        </nav>

        {isAdmin && (
          <div className="mb-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">Admin</p>
            <div className="mb-2 border-t border-[#1B1B1B]/10" />
            <nav className="flex flex-col gap-1">
              {ADMIN_NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-2 font-sans text-sm font-light text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="mt-auto border-t border-[#1B1B1B]/10 pt-4">
          <p className="font-sans text-xs text-[#1B1B1B]/40">{(session.user as any).email}</p>
          {isAdmin && (
            <p className="mt-0.5 font-sans text-xs font-medium text-[#9E8C61]">Admin</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
