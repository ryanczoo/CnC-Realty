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
  propertyAddress?: string | null;
  awaitingReview?: boolean | null;
  reviewSubmittedAt?: Date | string | null;
  pendingCommission?: unknown;
};
type Actor = { userId: string; role: "ADMIN" | "AGENT"; name: string | null };

// After a listing or transaction save that changed a commission.
//
// An agent changing the commission of a file the broker already cleared sends it
// back to the broker: it is flagged Awaiting Review, the old commission is kept
// in pendingCommission, and the broker is emailed. A broker saving a commission
// on a file with a change waiting counts as deciding it (viaEdit), clearing the
// pending change - and the review flag, if every required document is approved.
//
// Returns the file as it was just written, so the page shows the new state from
// the same response, or null when nothing was written.
export async function afterCommissionSave(
  kind: Kind,
  fileId: string,
  before: FileRow,
  after: FileRow,
  actor: Actor,
): Promise<Record<string, unknown> | null> {
  const changes = commissionChanges(kind, before, after);
  if (changes.length === 0) return null;

  if (actor.role === "AGENT") {
    if (!isAfterReview(before)) return null;
    const pendingCommission = buildPendingCommission(kind, before as Record<string, unknown>, changes, new Date());
    const data = { awaitingReview: true, pendingCommission: pendingCommission as unknown as Prisma.InputJsonValue };
    const written = await writeFile(kind, fileId, data);
    await sendSafely(() => sendCommissionChangeRequest({
      fileType: kind === "listing" ? "Listing" : "Transaction",
      address: before.propertyAddress ?? null,
      agentName: actor.name ?? "An agent",
      fileId,
      changes,
    }));
    return written;
  }

  const pending = before.pendingCommission as PendingCommission | null | undefined;
  if (!pending) return null;
  const items = await prisma.fileChecklistItem.findMany({
    where: kind === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId },
    ...CHECKLIST_ITEMS_WITH_DOCS_INCLUDE,
  });
  const ready = isReadyToClose(items as unknown as FileChecklistItemWithDocs[]);
  const written = await writeFile(kind, fileId, {
    pendingCommission: Prisma.DbNull,
    ...(ready && { awaitingReview: false }),
  });
  await prisma.fileActivity.create({
    data: {
      fileType: kind === "listing" ? "LISTING" : "TRANSACTION",
      ...(kind === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId }),
      actorId: actor.userId,
      actorRole: actor.role,
      type: "COMMISSION_CHANGE_APPROVED",
      payload: { changes: pending.changes, viaEdit: true },
    },
  });
  return written;
}

function writeFile(kind: Kind, fileId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (kind === "listing"
    ? prisma.listingFile.update({ where: { id: fileId }, data: data as Prisma.ListingFileUpdateInput })
    : prisma.transactionFile.update({ where: { id: fileId }, data: data as Prisma.TransactionFileUpdateInput })
  ) as unknown as Promise<Record<string, unknown>>;
}
