import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps = await prisma.dripStep.findMany({
    where: { campaignId: params.id },
    orderBy: { stepOrder: "asc" },
  });
  return NextResponse.json(steps);
}

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps: Array<{ stepOrder: number; delayDays: number; subject: string; body: string }> =
    await req.json();

  await prisma.$transaction([
    prisma.dripStep.deleteMany({ where: { campaignId: params.id } }),
    prisma.dripStep.createMany({
      data: steps.map((s) => ({ ...s, campaignId: params.id })),
    }),
  ]);

  return NextResponse.json({ saved: true });
}
