import { prisma } from "@/lib/prisma";
import { commissionChanges } from "@/lib/file-edit";

type Row = Parameters<typeof commissionChanges>[1];

// After a listing or transaction save: one COMMISSION_CHANGED activity listing
// each commission that actually changed (old -> new) and who changed it, so the
// broker can see every edit in the Activity tab. Nothing is written otherwise.
export async function logCommissionChanges(
  kind: "listing" | "transaction",
  fileId: string,
  before: Row,
  after: Row,
  actor: { userId: string; role: "ADMIN" | "AGENT" },
): Promise<void> {
  const changes = commissionChanges(kind, before, after);
  if (changes.length === 0) return;
  await prisma.fileActivity.create({
    data: {
      fileType: kind === "listing" ? "LISTING" : "TRANSACTION",
      ...(kind === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId }),
      actorId: actor.userId,
      actorRole: actor.role,
      type: "COMMISSION_CHANGED",
      payload: { changes },
    },
  });
}
