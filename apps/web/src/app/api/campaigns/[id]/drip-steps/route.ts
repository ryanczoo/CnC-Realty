import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const steps = await prisma.dripStep.findMany({
    where: { campaignId: params.id },
    orderBy: { stepOrder: "asc" },
  });
  return NextResponse.json(steps);
}

export async function POST(req: Request, { params }: Params) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let steps: Array<{ stepOrder: number; delayDays: number; subject: string; body: string }>;
  try {
    steps = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.dripStep.deleteMany({ where: { campaignId: params.id } }),
    prisma.dripStep.createMany({
      data: steps.map((s) => ({ ...s, campaignId: params.id })),
    }),
  ]);

  return NextResponse.json({ saved: true });
}
