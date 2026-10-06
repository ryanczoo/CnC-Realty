import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any).role;
  const isAdmin = role === "ADMIN";

  return (
    <div className="flex h-screen bg-[#F2F0EF] pt-16">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-[#1B1B1B]/10 bg-white px-4 py-6">
        <SidebarNav isAdmin={isAdmin} email={(session.user as any).email} />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
