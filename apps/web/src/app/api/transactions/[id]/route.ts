import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership, assertFileEditable } from "@/lib/api-auth";
import { changeFileStatus } from "@/lib/file-status";
import { calcReferralFee, FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
import { trimStrings } from "@/lib/form-validation";

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

  const locked = assertFileEditable("transaction", tx.status, session.user.role);
  if (locked) return locked;

  const body = trimStrings(await req.json());
  const role = isAdmin ? "ADMIN" : "AGENT";

  const referralFeeUpdate =
    body.status === "REFERRAL_BROKER_REVIEW" && body.referralAmountReceived !== undefined
      ? calcReferralFee(parseFloat(body.referralAmountReceived))
      : null;

  const fieldData = {
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
  };

  if (body.status && body.status !== tx.status) {
    const result = await changeFileStatus({
      kind: "transaction",
      fileId: params.id,
      toStatus: body.status,
      actor: { userId: session.user.id, role },
      extraData: fieldData,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ transaction: result.file, ...(result.emailWarning && { emailWarning: true }) });
  }

  const updated = await prisma.transactionFile.update({ where: { id: params.id }, data: fieldData });
  return NextResponse.json({ transaction: updated });
}
