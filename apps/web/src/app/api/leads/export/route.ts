import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { leadsToCSV } from "@/lib/lead-export";

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;

  let where = {};
  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json([]);
    where = { agentId: agent.id };
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      agent: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const csv = leadsToCSV(leads);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cnc-leads-${date}.csv"`,
    },
  });
}
