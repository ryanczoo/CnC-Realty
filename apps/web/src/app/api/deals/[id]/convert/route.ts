import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { PIPELINE_STAGES } from "@/lib/deal-pipeline";
import type { TransactionSide } from "@cnc/database";

const SIDE_BY_PIPELINE: Record<string, TransactionSide> = {
  BUYERS: "PURCHASE",
  SELLERS: "LISTING",
  LEASE_TENANT: "LEASE_TENANT",
  LEASE_LANDLORD: "LEASE_LANDLORD",
};
const PRICE_FIELD_BY_PIPELINE: Record<string, "salePrice" | "listPrice" | "leasePrice"> = {
  BUYERS: "salePrice",
  SELLERS: "listPrice",
  LEASE_TENANT: "leasePrice",
  LEASE_LANDLORD: "leasePrice",
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const role = (session.user as any).role;
  const deal = await prisma.deal.findUnique({ where: { id: params.id } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role !== "ADMIN") {
    if (!session.user.agentId || deal.agentId !== session.user.agentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const stages = PIPELINE_STAGES[deal.pipeline as keyof typeof PIPELINE_STAGES] ?? [];
  const terminalStage = stages[stages.length - 2]; // last entry before FALLEN_OUT
  if (deal.stage !== terminalStage) {
    return NextResponse.json({ error: `Deal must be in the final stage to convert` }, { status: 400 });
  }

  if (deal.transactionFileId) {
    return NextResponse.json({ error: "Deal is already linked to a transaction file" }, { status: 409 });
  }

  const transactionSide = SIDE_BY_PIPELINE[deal.pipeline];
  const priceField = PRICE_FIELD_BY_PIPELINE[deal.pipeline];

  const tf = await prisma.transactionFile.create({
    data: {
      agentId: deal.agentId,
      originatingLeadId: deal.leadId,
      propertyAddress: deal.propertyAddress ?? "",
      city: "",
      state: "CA",
      zip: "",
      transactionSide,
      status: "INCOMPLETE",
      [priceField]: deal.price,
    },
  });

  await prisma.deal.update({
    where: { id: deal.id },
    data: { transactionFileId: tf.id },
  });

  return NextResponse.json({ transactionFileId: tf.id }, { status: 201 });
}
