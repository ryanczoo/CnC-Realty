import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import { sendSubmitForReview } from "@/lib/email/transaction-emails";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({
    where: { id: params.id },
    include: { checklistItems: { include: { documents: true } }, agent: { include: { user: true } } },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tx.agentId !== session.user.agentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { satisfied, required } = getChecklistProgress(tx.checklistItems);
  if (satisfied < required) {
    return NextResponse.json({ error: `${required - satisfied} required checklist item(s) still need documents` }, { status: 400 });
  }

  await prisma.transactionFile.update({ where: { id: params.id }, data: { awaitingReview: true } });
  await prisma.fileActivity.create({
    data: { fileType: "TRANSACTION", transactionFileId: params.id, actorId: session.user.id, actorRole: "AGENT", type: "SUBMITTED_FOR_REVIEW" },
  });

  await sendSubmitForReview({ fileType: "Transaction", address: tx.propertyAddress, agentName: tx.agent.user.name ?? "Agent", fileId: params.id });

  return NextResponse.json({ ok: true });
}
