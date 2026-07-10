import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { calcDaysInStage, isValidStageForPipeline } from "@/lib/deal-pipeline";

const patchSchema = z.object({
  stage: z.string().optional(),
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

async function assertDealOwnership(dealId: string, agentId: string | null, role: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { lead: { select: { firstName: true, lastName: true } } },
  });
  if (!deal) return { deal: null, owns: false };
  if (role === "ADMIN") return { deal, owns: true };
  return { deal, owns: !!agentId && deal.agentId === agentId };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { deal, owns } = await assertDealOwnership(params.id, session.user.agentId, (session.user as any).role);
  if (!deal || !owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serializeDeal(deal));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { deal, owns } = await assertDealOwnership(params.id, session.user.agentId, (session.user as any).role);
  if (!deal || !owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = patchSchema.parse(await req.json());

    if (body.stage !== undefined && !isValidStageForPipeline(body.stage, deal.pipeline)) {
      return NextResponse.json({ error: `Stage ${body.stage} is not valid for ${deal.pipeline} pipeline` }, { status: 400 });
    }

    const stageChanged = body.stage !== undefined && body.stage !== deal.stage;

    const updated = await prisma.deal.update({
      where: { id: params.id },
      data: {
        ...(body.stage !== undefined && { stage: body.stage as any }),
        ...(stageChanged && { stageUpdatedAt: new Date() }),
        ...("propertyAddress" in body && { propertyAddress: body.propertyAddress }),
        ...("price" in body && { price: body.price }),
        ...("expectedCloseDate" in body && { expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null }),
        ...("notes" in body && { notes: body.notes }),
      },
      include: { lead: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json(serializeDeal(updated));
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    if ((err as any)?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { deal, owns } = await assertDealOwnership(params.id, session.user.agentId, (session.user as any).role);
  if (!deal || !owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await prisma.deal.delete({ where: { id: params.id } });
  } catch (err) {
    if ((err as any)?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
