import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { PHONE_FIELDS_16 } from "@/lib/dashboard-phone";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any).role;
  const isAdmin = role === "ADMIN";

  return (
    <div className={`flex h-screen bg-[#F2F0EF] pt-16 max-lg:h-[100svh] max-lg:flex-col ${PHONE_FIELDS_16}`}>
      <DashboardMobileNav email={(session.user as any).email} isAdmin={isAdmin} />
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-[#1B1B1B]/10 bg-white px-4 py-6 max-lg:hidden">
        <SidebarNav isAdmin={isAdmin} email={(session.user as any).email} />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8 max-lg:min-h-0 max-lg:p-4">{children}</main>
    </div>
  );
}
