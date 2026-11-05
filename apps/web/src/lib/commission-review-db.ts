import { Prisma } from "@cnc/database";
import { prisma } from "@/lib/prisma";
import { commissionChanges, transactionCommissionEdit } from "@/lib/file-edit";
import { buildPendingCommission, isAfterReview, type PendingCommission } from "@/lib/commission-review";
import { CHECKLIST_ITEMS_WITH_DOCS_INCLUDE, isReadyToClose } from "@/lib/transaction-helpers";
import { sendCommissionChangeRequest, sendCommissionChangeRejected } from "@/lib/email/transaction-emails";
import { sendSafely } from "@/lib/email/send-safely";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

type Kind = "listing" | "transaction";
type FileRow = Parameters<typeof commissionChanges>[1] & {
  id?: string;
  propertyAddress?: string | null;
  awaitingReview?: boolean | null;
  reviewSubmittedAt?: Date | string | null;
  pendingCommission?: unknown;
};
type Actor = { userId: string; role: "ADMIN" | "AGENT"; name: string | null };

type Changes = ReturnType<typeof commissionChanges>;
export type CommissionFollowUp =
  | { type: "agent"; changes: Changes }
  | { type: "admin"; changes: Changes }
  | null;

// Decides, BEFORE a listing or transaction save, what the commission change does
// to the review state, so it can be written in the same update as the save.
//
// An agent changing the commission of a file the broker already cleared sends it
// back to the broker: flagged Awaiting Review, the old commission kept in
// pendingCommission. A broker saving a commission on a file with a change
// waiting counts as deciding it (viaEdit): the pending change is cleared, and so
// is the review flag if every required document is approved.
// afterPreview is the file as it will look once saved ({ ...before, ...fieldData }).
export async function planCommissionReview(
  kind: Kind,
  before: FileRow,
  afterPreview: FileRow,
  actor: Actor,
): Promise<{ data: Record<string, unknown>; followUp: CommissionFollowUp }> {
  const none = { data: {}, followUp: null };
  const changes = commissionChanges(kind, before, afterPreview);
  if (changes.length === 0) return none;

  if (actor.role === "AGENT") {
    if (!isAfterReview(before)) return none;
    const pending = buildPendingCommission(kind, before as Record<string, unknown>, changes, new Date());
    return {
      data: { awaitingReview: true, pendingCommission: pending as unknown as Prisma.InputJsonValue },
      followUp: { type: "agent", changes },
    };
  }

  const pending = before.pendingCommission as PendingCommission | null | undefined;
  if (!pending) return none;
  const items = await prisma.fileChecklistItem.findMany({
    where: kind === "listing" ? { listingFileId: fileIdOf(before) } : { transactionFileId: fileIdOf(before) },
    ...CHECKLIST_ITEMS_WITH_DOCS_INCLUDE,
  });
  const ready = isReadyToClose(items as unknown as FileChecklistItemWithDocs[]);
  return {
    data: { pendingCommission: Prisma.DbNull, ...(ready && { awaitingReview: false }) },
    followUp: { type: "admin", changes: pending.changes },
  };
}

// After the save succeeded: email the broker (agent case) or log the approval
// (broker case).
export async function finishCommissionReview(
  followUp: CommissionFollowUp,
  kind: Kind,
  fileId: string,
  before: FileRow,
  actor: Actor,
): Promise<void> {
  if (!followUp) return;
  if (followUp.type === "agent") {
    await sendSafely(() => sendCommissionChangeRequest({
      fileType: kind === "listing" ? "Listing" : "Transaction",
      address: before.propertyAddress ?? null,
      agentName: actor.name ?? "An agent",
      fileId,
      changes: followUp.changes,
    }));
    return;
  }
  await prisma.fileActivity.create({
    data: {
      fileType: kind === "listing" ? "LISTING" : "TRANSACTION",
      ...(kind === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId }),
      actorId: actor.userId,
      actorRole: actor.role,
      type: "COMMISSION_CHANGE_APPROVED",
      payload: { changes: followUp.changes, viaEdit: true },
    },
  });
}

// Status-change saves cannot carry the review fields (changeFileStatus owns
// them), so this branch writes them separately, after the status change.
// Returns the file as written, or null when nothing was written.
export async function afterCommissionSave(
  kind: Kind,
  fileId: string,
  before: FileRow,
  after: FileRow,
  actor: Actor,
): Promise<Record<string, unknown> | null> {
  const { data, followUp } = await planCommissionReview(kind, { ...before, id: fileId } as FileRow, after, actor);
  if (!followUp) return null;
  const written = (kind === "listing"
    ? await prisma.listingFile.update({ where: { id: fileId }, data: data as Prisma.ListingFileUpdateInput })
    : await prisma.transactionFile.update({ where: { id: fileId }, data: data as Prisma.TransactionFileUpdateInput })
  ) as unknown as Record<string, unknown>;
  await finishCommissionReview(followUp, kind, fileId, before, actor);
  return written;
}

export type ResolveResult =
  | { ok: true; file: Record<string, unknown>; emailWarning?: boolean }
  | { ok: false; status: number; error: string };

// The broker decides a commission change an agent asked for after approval.
// Approve keeps the new commission; reject puts back the old one (a transaction
// recomputes its dollar amounts and GCI the way a normal save does). Either way the
// pending change is cleared, and so is the review flag if every required document
// is approved. The commission restore, the clear and the flag go in ONE update, so a
// failure cannot half-apply; the activity row and the email follow only once it
// has succeeded.
export async function resolveCommissionChange(
  kind: Kind,
  fileId: string,
  decision: { approve: true } | { approve: false; reason: string },
  actor: Actor,
): Promise<ResolveResult> {
  const include = { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE, agent: { include: { user: true } } };
  const file = (kind === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, include })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, include })
  ) as unknown as (FileRow & {
    checklistItems: unknown;
    agent?: { user?: { email: string; name: string | null } | null } | null;
  }) | null;
  if (!file) return { ok: false, status: 404, error: "File not found" };

  const pending = file.pendingCommission as PendingCommission | null | undefined;
  if (!pending) return { ok: false, status: 400, error: "There's no commission change to review" };

  const ready = isReadyToClose(file.checklistItems as unknown as FileChecklistItemWithDocs[]);
  const restore = decision.approve
    ? {}
    : kind === "listing"
      ? { commissionPercent: pending.before.commissionPercent ?? null, commissionAmount: pending.before.commissionAmount ?? null }
      : transactionCommissionEdit(pending.before, file as Parameters<typeof transactionCommissionEdit>[1]);
  const data = { ...restore, pendingCommission: Prisma.DbNull, ...(ready && { awaitingReview: false }) };

  const written = (kind === "listing"
    ? await prisma.listingFile.update({ where: { id: fileId }, data: data as Prisma.ListingFileUpdateInput })
    : await prisma.transactionFile.update({ where: { id: fileId }, data: data as Prisma.TransactionFileUpdateInput })
  ) as unknown as Record<string, unknown>;

  await prisma.fileActivity.create({
    data: {
      fileType: kind === "listing" ? "LISTING" : "TRANSACTION",
      ...(kind === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId }),
      actorId: actor.userId,
      actorRole: actor.role,
      type: decision.approve ? "COMMISSION_CHANGE_APPROVED" : "COMMISSION_CHANGE_REJECTED",
      payload: decision.approve ? { changes: pending.changes } : { changes: pending.changes, reason: decision.reason },
    },
  });

  let emailFailed = false;
  const agentUser = file.agent?.user;
  if (!decision.approve && agentUser) {
    const { failed } = await sendSafely(() => sendCommissionChangeRejected({
      agentEmail: agentUser.email,
      agentName: agentUser.name ?? "Agent",
      fileType: kind === "listing" ? "Listing" : "Transaction",
      address: file.propertyAddress ?? null,
      fileId,
      reason: decision.reason,
      changes: pending.changes,
    }));
    emailFailed = failed;
  }
  return { ok: true, file: written, ...(emailFailed && { emailWarning: true }) };
}

function fileIdOf(f: FileRow): string {
  return (f as { id: string }).id;
}
