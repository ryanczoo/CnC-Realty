import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
});

async function getAgentId(userId: string) {
  const agent = await prisma.agent.findUnique({ where: { userId }, select: { id: true } });
  return agent?.id ?? null;
}

async function checkAccess(id: string, userId: string, role: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true, agentId: true } });
  if (!campaign) return { exists: false, forbidden: false };
  if (role === "ADMIN") return { exists: true, forbidden: false };
  const agentId = await getAgentId(userId);
  return { exists: true, forbidden: agentId !== campaign.agentId };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { exists, forbidden } = await checkAccess(params.id, session.user.id, session.user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      _count: { select: { contacts: true } },
    },
  });

  return NextResponse.json(campaign);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { exists, forbidden } = await checkAccess(params.id, session.user.id, session.user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const updated = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { exists, forbidden } = await checkAccess(params.id, session.user.id, session.user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
