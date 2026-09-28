import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { UNASSIGNED_LEADS_WHERE } from "@/lib/unassigned-leads";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const leads = await prisma.lead.findMany({
    where: UNASSIGNED_LEADS_WHERE,
    orderBy: { createdAt: "desc" },
    take: 500,
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
  });

  return NextResponse.json(
    leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))
  );
}
