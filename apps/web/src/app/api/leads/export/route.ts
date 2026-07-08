import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { leadsToCSV } from "@/lib/lead-export";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const leads = await prisma.lead.findMany({
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
