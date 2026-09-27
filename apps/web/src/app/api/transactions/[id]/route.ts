import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership, assertFileEditable } from "@/lib/api-auth";
import { changeFileStatus, maybeAutoPending } from "@/lib/file-status";
import { followDates } from "@/lib/auto-status";
import { transactionEditData, requiredFieldError, commissionPercentError, transactionCommissionEdit } from "@/lib/file-edit";
import { sendCancellationRequested } from "@/lib/email/transaction-emails";
import { sendSafely } from "@/lib/email/send-safely";
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

  // Detail fields follow the shared edit rules (lib/file-edit): parsed, blanks ->
  // null, required ones can't be cleared.
  const required = requiredFieldError("transaction", body, tx) ?? commissionPercentError(body);
  if (required) return NextResponse.json({ error: required }, { status: 400 });

  const fieldData = {
    ...transactionEditData(body),
    ...transactionCommissionEdit(body, tx),
    ...(body.commissionGCI !== undefined && { commissionGCI: body.commissionGCI ? parseFloat(body.commissionGCI) : null }),
    ...(body.commissionSplit !== undefined && { commissionSplit: body.commissionSplit ? parseFloat(body.commissionSplit) : null }),
    ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes || null }),
    ...(body.referralAmountReceived !== undefined && { referralAmountReceived: parseFloat(body.referralAmountReceived) }),
    ...(referralFeeUpdate && { referralCncFee: referralFeeUpdate.cncFee }),
  };

  if (body.status && body.status !== tx.status) {
    // An agent's cancellation request must say why; the reason is logged with the
    // status change and emailed to the broker, who approves or declines it.
    const isCancellationRequest = body.status === "CANCELED_PENDING" && !isAdmin;
    const reason = typeof body.cancellationReason === "string" ? body.cancellationReason.trim() : "";
    if (isCancellationRequest && !reason) {
      return NextResponse.json({ error: "Please give a reason for the cancellation" }, { status: 400 });
    }
    const result = await changeFileStatus({
      kind: "transaction",
      fileId: params.id,
      toStatus: body.status,
      actor: { userId: session.user.id, role },
      extraData: fieldData,
      ...(reason && { activityPayloadExtra: { reason } }),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (isCancellationRequest) {
      await sendSafely(() => sendCancellationRequested({
        address: tx.propertyAddress,
        agentName: session.user.name ?? "An agent",
        reason,
        fileId: params.id,
      }));
    }
    return NextResponse.json({ transaction: result.file, ...(result.emailWarning && { emailWarning: true }) });
  }

  const updated = await prisma.transactionFile.update({ where: { id: params.id }, data: fieldData });
  // A saved date can move the status (Expired -> Pending), and saved details can
  // complete the file (-> Pending).
  const actor = { userId: session.user.id, role } as const;
  await followDates("transaction", params.id, actor);
  await maybeAutoPending(params.id, actor);
  return NextResponse.json({ transaction: updated });
}
