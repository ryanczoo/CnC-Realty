import { Prisma } from "@cnc/database";
import { prisma } from "@/lib/prisma";
import { commissionChanges } from "@/lib/file-edit";
import { buildPendingCommission, isAfterReview, type PendingCommission } from "@/lib/commission-review";
import { CHECKLIST_ITEMS_WITH_DOCS_INCLUDE, isReadyToClose } from "@/lib/transaction-helpers";
import { sendCommissionChangeRequest } from "@/lib/email/transaction-emails";
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

function fileIdOf(f: FileRow): string {
  return (f as { id: string }).id;
}
