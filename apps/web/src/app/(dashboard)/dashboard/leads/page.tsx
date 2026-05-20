import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadKanban } from "@/components/dashboard/LeadKanban";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  let leads: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string; createdAt: Date }[] = [];

  try {
    const agent = role !== "ADMIN"
      ? await prisma.agent.findUnique({ where: { userId } })
      : null;

    leads = await prisma.lead.findMany({
      where: agent ? { agentId: agent.id } : {},
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, createdAt: true },
    });
  } catch {
    // Shows empty board on DB error
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Leads</h1>
      </div>
      <LeadKanban initialLeads={leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))} />
    </div>
  );
}
