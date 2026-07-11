import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

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

  if (deal.stage !== "OFFER_ACCEPTED") {
    return NextResponse.json({ error: "Deal must be in OFFER_ACCEPTED stage to convert" }, { status: 400 });
  }

  if (deal.transactionFileId) {
    return NextResponse.json({ error: "Deal is already linked to a transaction file" }, { status: 409 });
  }

  const isBuyers = deal.pipeline === "BUYERS";

  const tf = await prisma.transactionFile.create({
    data: {
      agentId: deal.agentId,
      originatingLeadId: deal.leadId,
      propertyAddress: deal.propertyAddress ?? "",
      city: "",
      state: "CA",
      zip: "",
      transactionSide: isBuyers ? "PURCHASE" : "LISTING",
      status: "INCOMPLETE",
      ...(isBuyers ? { salePrice: deal.price } : { listPrice: deal.price }),
    },
  });

  await prisma.deal.update({
    where: { id: deal.id },
    data: { transactionFileId: tf.id },
  });

  return NextResponse.json({ transactionFileId: tf.id }, { status: 201 });
}
