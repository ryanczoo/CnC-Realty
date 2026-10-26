import { prisma } from "@/lib/prisma";
import { checklistTemplateWhere } from "@/lib/checklist-template-match";
import { checklistCreateData, planYearChecklistChange, shortItemName } from "@/lib/year-checklist";

type Kind = "listing" | "transaction";
type Actor = { userId: string; role: "ADMIN" | "AGENT" };
type Facts = { yearBuilt?: number | null; propertyType?: string | null };

// Finished files keep their checklist exactly as it was. Expired and Withdrawn
// stay open here: they come back (by a new date, or the broker reactivating),
// and a revived file must not be missing its year-based forms.
const FINISHED = new Set(["CLOSED", "CANCELED", "CANCELED_APPROVED", "ARCHIVED", "REFERRAL_SUCCESSFUL", "REFERRAL_UNSUCCESSFUL"]);

const ROWS = { select: { id: true, name: true, isRequired: true, _count: { select: { documents: true } } } };

// Brings a file's year-based checklist rows in line with its Year Built, using
// the file's current template. Never touches a row with a document, never
// changes status, and writes one Activity line when anything changed.
export async function recheckYearChecklist(kind: Kind, fileId: string, actor: Actor, reason: string): Promise<{ added: string[]; removed: string[] }> {
  const none = { added: [], removed: [] };
  const file = kind === "listing"
    ? await prisma.listingFile.findUnique({
        where: { id: fileId },
        select: { id: true, status: true, listingType: true, yearBuilt: true, checklistItems: ROWS },
      })
    : await prisma.transactionFile.findUnique({
        where: { id: fileId },
        select: { id: true, status: true, transactionSide: true, propertyCategory: true, yearBuilt: true, checklistItems: ROWS },
      });
  if (!file || FINISHED.has(file.status)) return none;

  const where = "listingType" in file
    ? checklistTemplateWhere("listing", { listingType: file.listingType })
    : checklistTemplateWhere("transaction", { transactionSide: file.transactionSide, propertyCategory: file.propertyCategory });
  const template = await prisma.checklistTemplate.findFirst({ where, include: { items: { orderBy: { order: "asc" } } } });
  if (!template) return none;

  const rows = file.checklistItems.map((r) => ({ id: r.id, name: r.name, isRequired: r.isRequired, documentCount: r._count.documents }));
  const plan = planYearChecklistChange(template.items, rows, file.yearBuilt);
  if (plan.add.length + plan.removeIds.length + plan.requiredUpdates.length === 0) return none;

  const fileType = kind === "listing" ? "LISTING" as const : "TRANSACTION" as const;
  const link = kind === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId };
  const added = plan.add.map((i) => shortItemName(i.name));
  const removed = rows.filter((r) => plan.removeIds.includes(r.id)).map((r) => shortItemName(r.name));
  const ops = [
    ...(plan.add.length ? [prisma.fileChecklistItem.createMany({ data: checklistCreateData(fileType, plan.add, file.yearBuilt).map((d) => ({ ...d, ...link })) })] : []),
    ...(plan.removeIds.length ? [prisma.fileChecklistItem.deleteMany({ where: { id: { in: plan.removeIds } } })] : []),
    ...plan.requiredUpdates.map((u) => prisma.fileChecklistItem.update({ where: { id: u.id }, data: { isRequired: u.isRequired, builtBefore: u.builtBefore } })),
    prisma.fileActivity.create({
      data: {
        fileType, listingFileId: kind === "listing" ? fileId : null, transactionFileId: kind === "transaction" ? fileId : null,
        actorId: actor.userId, actorRole: actor.role, type: "CHECKLIST_UPDATED",
        payload: { reason, added, removed },
      },
    }),
  ];
  await prisma.$transaction(ops);
  return { added, removed };
}

function factsReason(facts: Facts): string {
  if ("yearBuilt" in facts) return facts.yearBuilt == null ? "Year Built cleared" : `Year Built set to ${facts.yearBuilt}`;
  return facts.propertyType ? `Property Type set to ${facts.propertyType}` : "Property Type cleared";
}

// After a file's Year Built or Property Type is saved: a converted listing and
// its transaction share these facts, so the change is copied to the open linked
// file, and every touched file's checklist is re-checked.
export async function applyPropertyFacts(kind: Kind, fileId: string, facts: Facts, actor: Actor): Promise<void> {
  const reason = factsReason(facts);
  const touched: [Kind, string][] = [[kind, fileId]];
  if (kind === "listing") {
    const txs = await prisma.transactionFile.findMany({ where: { originatingListingId: fileId }, select: { id: true, status: true } });
    for (const t of txs) {
      if (FINISHED.has(t.status)) continue;
      await prisma.transactionFile.update({ where: { id: t.id }, data: facts });
      touched.push(["transaction", t.id]);
    }
  } else {
    const tx = await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { originatingListingId: true } });
    if (tx?.originatingListingId) {
      const l = await prisma.listingFile.findUnique({ where: { id: tx.originatingListingId }, select: { id: true, status: true } });
      if (l && !FINISHED.has(l.status)) {
        await prisma.listingFile.update({ where: { id: l.id }, data: facts });
        touched.push(["listing", l.id]);
      }
    }
  }
  for (const [k, id] of touched) await recheckYearChecklist(k, id, actor, reason);
}
