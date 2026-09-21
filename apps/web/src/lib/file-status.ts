import { prisma } from "@/lib/prisma";
import {
  canTransitionListing,
  canTransitionTransaction,
  isReadyToClose,
  CHECKLIST_ITEMS_WITH_DOCS_INCLUDE,
} from "@/lib/transaction-helpers";
import { sendFileClosed } from "@/lib/email/transaction-emails";
import { sendSafely } from "@/lib/email/send-safely";
import type { ListingStatus, TransactionFileStatus, FileChecklistItemWithDocs } from "@/types/transaction";

export type ChangeFileStatusArgs = {
  kind: "listing" | "transaction";
  fileId: string;
  toStatus: string;
  actor: { userId: string; role: "ADMIN" | "AGENT" };
  extraData?: Record<string, unknown>;
};

export type ChangeFileStatusResult =
  | { ok: true; file: any; emailWarning?: true }
  | { ok: false; status: number; error: string };

// The one place a file's status changes. Validation runs first, so a refused
// change writes nothing. Only an admin's change clears Awaiting Review: the
// broker may still be checking price and commission after the documents are done.
export async function changeFileStatus({
  kind,
  fileId,
  toStatus,
  actor,
  extraData = {},
}: ChangeFileStatusArgs): Promise<ChangeFileStatusResult> {
  const isListing = kind === "listing";

  const file: any = isListing
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, include: { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, include: { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE } });
  if (!file) return { ok: false, status: 404, error: "Not found" };

  const allowed = isListing
    ? canTransitionListing(file.status as ListingStatus, toStatus as ListingStatus, actor.role)
    : canTransitionTransaction(file.status as TransactionFileStatus, toStatus as TransactionFileStatus, actor.role);
  if (!allowed) {
    return { ok: false, status: 400, error: `Cannot transition from ${file.status} to ${toStatus}` };
  }
  if (toStatus === "CLOSED" && !isReadyToClose((file.checklistItems ?? []) as FileChecklistItemWithDocs[])) {
    return { ok: false, status: 400, error: "Cannot close: not all required documents are approved" };
  }

  // extraData may never set the status or Awaiting Review: only the target status and
  // the actor decide those.
  const { awaitingReview: _ignoredAwaitingReview, status: _ignoredStatus, ...safeExtra } = extraData;
  const data = {
    ...safeExtra,
    status: toStatus,
    ...(actor.role === "ADMIN" && { awaitingReview: false }),
  };
  const activityData = {
    fileType: isListing ? ("LISTING" as const) : ("TRANSACTION" as const),
    listingFileId: isListing ? fileId : null,
    transactionFileId: isListing ? null : fileId,
    actorId: actor.userId,
    actorRole: actor.role,
    type: "STATUS_CHANGED" as const,
    payload: { from: file.status, to: toStatus },
  };

  // One transaction: the status change and its audit row succeed or fail together, so a
  // failed log write can never leave a file changed with no record (and a retry stuck on
  // "Cannot transition from CLOSED to CLOSED").
  const updateOp: any = isListing
    ? prisma.listingFile.update({ where: { id: fileId }, data: data as any })
    : prisma.transactionFile.update({ where: { id: fileId }, data: data as any });
  const [updated] = await prisma.$transaction([updateOp, prisma.fileActivity.create({ data: activityData })]);

  let emailFailed = false;
  if (toStatus === "CLOSED") {
    const agentRecord = await prisma.agent.findUnique({ where: { id: file.agentId }, include: { user: true } });
    if (agentRecord?.user) {
      const { failed } = await sendSafely(() =>
        sendFileClosed({
          agentEmail: agentRecord.user.email,
          agentName: agentRecord.user.name ?? "Agent",
          address: file.propertyAddress,
          city: file.city,
          state: file.state,
          zip: file.zip,
          fileType: kind,
          fileId,
        })
      );
      emailFailed = failed;
    }
  }

  return { ok: true, file: updated, ...(emailFailed && actor.role === "ADMIN" && { emailWarning: true as const }) };
}
