import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const LEAD_STATUSES = [
  "NEW","CONTACTED","QUALIFIED","HOT_PROSPECT","NURTURE",
  "SHOWING","OFFER","UNDER_CONTRACT","CLOSED","LOST","SPHERE",
] as const;

const patchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
  priceMin: z.number().nullable().optional(),
  priceMax: z.number().nullable().optional(),
  timeframeToMove: z.string().nullable().optional(),
});

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const [agent, lead] = await Promise.all([
    prisma.agent.findUnique({ where: { userId } }),
    prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } }),
  ]);
  return agent && lead && lead.agentId === agent.id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      tags: { include: { tag: true } },
      tasks: { orderBy: { createdAt: "asc" } },
      relationshipsFrom: { include: { toLead: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      relationshipsTo:   { include: { fromLead: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      agent: { include: { user: { select: { name: true } } } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const lead = await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
