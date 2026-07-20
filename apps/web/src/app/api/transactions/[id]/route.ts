import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership } from "@/lib/api-auth";
import { canTransitionTransaction, calcReferralFee, FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
import { sendFileClosed } from "@/lib/email/transaction-emails";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({
    where: { id: params.id },
    include: { ...FILE_DETAIL_INCLUDE, conditions: { orderBy: { dueDate: "asc" } } },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { forbidden } = checkOwnership(tx, session.user.agentId, session.user.role);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ transaction: tx });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const { forbidden } = checkOwnership(tx, session.user.agentId, session.user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  if (body.status && body.status !== tx.status) {
    if (!canTransitionTransaction(tx.status, body.status, role)) {
      return NextResponse.json({ error: `Cannot transition from ${tx.status} to ${body.status}` }, { status: 400 });
    }
  }

  const referralFeeUpdate =
    body.status === "REFERRAL_BROKER_REVIEW" && body.referralAmountReceived !== undefined
      ? calcReferralFee(parseFloat(body.referralAmountReceived))
      : null;

  const updated = await prisma.transactionFile.update({
    where: { id: params.id },
    data: {
      ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
      ...(body.salePrice !== undefined && { salePrice: body.salePrice ? parseFloat(body.salePrice) : null }),
      ...(body.closeOfEscrow !== undefined && { closeOfEscrow: body.closeOfEscrow ? new Date(body.closeOfEscrow) : null }),
      ...(body.inspectionDeadline !== undefined && { inspectionDeadline: body.inspectionDeadline ? new Date(body.inspectionDeadline) : null }),
      ...(body.appraisalDeadline !== undefined && { appraisalDeadline: body.appraisalDeadline ? new Date(body.appraisalDeadline) : null }),
      ...(body.loanApprovalDeadline !== undefined && { loanApprovalDeadline: body.loanApprovalDeadline ? new Date(body.loanApprovalDeadline) : null }),
      ...(body.commissionGCI !== undefined && { commissionGCI: body.commissionGCI ? parseFloat(body.commissionGCI) : null }),
      ...(body.commissionSplit !== undefined && { commissionSplit: body.commissionSplit ? parseFloat(body.commissionSplit) : null }),
      ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
      ...(body.referralAmountReceived !== undefined && { referralAmountReceived: parseFloat(body.referralAmountReceived) }),
      ...(referralFeeUpdate && { referralCncFee: referralFeeUpdate.cncFee }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  if (body.status && body.status !== tx.status) {
    await prisma.fileActivity.create({
      data: { fileType: "TRANSACTION", transactionFileId: params.id, actorId: session.user.id, actorRole: role, type: "STATUS_CHANGED", payload: { from: tx.status, to: body.status } },
    });
    if (body.status === "CLOSED") {
      const agentRecord = await prisma.agent.findUnique({ where: { id: tx.agentId }, include: { user: true } });
      if (agentRecord?.user) {
        await sendFileClosed({ agentEmail: agentRecord.user.email, agentName: agentRecord.user.name ?? "Agent", address: tx.propertyAddress, fileType: "transaction", fileId: params.id });
      }
    }
  }

  return NextResponse.json({ transaction: updated });
}
