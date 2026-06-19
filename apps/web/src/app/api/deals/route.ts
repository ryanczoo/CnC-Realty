import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { calcDaysInStage, isValidStageForPipeline } from "@/lib/deal-pipeline";
import type { DealPipeline } from "@prisma/client";

const createSchema = z.object({
  leadId: z.string().min(1),
  pipeline: z.enum(["BUYERS", "SELLERS"]),
  stage: z.string().min(1),
  propertyAddress: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function serializeDeal(deal: any) {
  return {
    id: deal.id,
    leadId: deal.leadId,
    leadName: `${deal.lead.firstName} ${deal.lead.lastName}`,
    pipeline: deal.pipeline,
    stage: deal.stage,
    propertyAddress: deal.propertyAddress,
    price: deal.price,
    expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
    notes: deal.notes,
    transactionFileId: deal.transactionFileId,
    daysInStage: calcDaysInStage(deal.stageUpdatedAt),
    stageUpdatedAt: deal.stageUpdatedAt.toISOString(),
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const url = new URL(req.url);
  const pipeline = url.searchParams.get("pipeline") as DealPipeline | null;
  const leadId = url.searchParams.get("leadId");

  const role = (session.user as any).role;
  let agentId: string | null = null;

  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    if (!agent) return NextResponse.json([]);
    agentId = agent.id;
  }

  const where: Record<string, unknown> = {};
  if (agentId) where.agentId = agentId;
  if (pipeline) where.pipeline = pipeline;
  if (leadId) where.leadId = leadId;

  const deals = await prisma.deal.findMany({
    where,
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(deals.map(serializeDeal));
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });

  try {
    const body = createSchema.parse(await req.json());

    if (!isValidStageForPipeline(body.stage, body.pipeline)) {
      return NextResponse.json({ error: `Stage ${body.stage} is not valid for ${body.pipeline} pipeline` }, { status: 400 });
    }

    const deal = await prisma.deal.create({
      data: {
        agentId: agent.id,
        leadId: body.leadId,
        pipeline: body.pipeline,
        stage: body.stage as any,
        propertyAddress: body.propertyAddress ?? null,
        price: body.price ?? null,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
        notes: body.notes ?? null,
      },
      include: { lead: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json(serializeDeal(deal), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
