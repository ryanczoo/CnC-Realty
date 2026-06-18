import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return agent && lead && lead.agentId === agent.id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { email: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ saved: [], viewed: [] });

  const user = await prisma.user.findFirst({ where: { email: lead.email, role: "BUYER" } });
  if (!user) return NextResponse.json({ saved: [], viewed: [] });

  const [saved, viewed] = await Promise.all([
    prisma.savedProperty.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.propertyView.findMany({
      where: { userId: user.id },
      orderBy: { viewedAt: "desc" },
      take: 50,
    }),
  ]);

  const allMls = [...saved.map(s => s.mlsNumber), ...viewed.map(v => v.mlsNumber)];
  const mlsNumbers = Array.from(new Set(allMls));
  const properties = await prisma.property.findMany({
    where: { mlsNumber: { in: mlsNumbers } },
    select: { mlsNumber: true, address: true, city: true, listPrice: true, beds: true, baths: true, sqft: true, photos: true },
  });
  const propMap = Object.fromEntries(properties.map(p => [p.mlsNumber, p]));

  return NextResponse.json({
    saved: saved.map(s => ({ ...s, property: propMap[s.mlsNumber] ?? null })),
    viewed: viewed.map(v => ({ ...v, property: propMap[v.mlsNumber] ?? null })),
  });
}
