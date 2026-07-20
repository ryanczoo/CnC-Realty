import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const existingCampaign = await prisma.campaign.findUnique({ where: { id: params.id }, select: { id: true, agentId: true } });
  const { exists, forbidden } = checkOwnership(existingCampaign, session.user.agentId, session.user.role);
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

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id }, select: { id: true, agentId: true } });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
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
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
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

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id }, select: { id: true, agentId: true } });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
