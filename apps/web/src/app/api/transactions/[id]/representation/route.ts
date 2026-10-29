import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { checklistTemplateWhere } from "@/lib/checklist-template-match";
import { canChangeRepresentation, planRepresentationChange, templateItemsForFile } from "@/lib/representation";
import { checklistCreateData, shortItemName } from "@/lib/year-checklist";
import { resolveCommission } from "@/lib/commission";
import { isLeaseSide } from "@/types/transaction";

const FINISHED = new Set(["CLOSED", "CANCELED_APPROVED", "ARCHIVED"]);

// Admin only: switch a file between the sides of its own family (Purchase /
// Listing / Dual, or the lease sides). The checklist is re-planned, the
// commission total is recomputed, and one Activity line records the change.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const to = body && typeof body.transactionSide === "string" ? body.transactionSide : null;

  const file = await prisma.transactionFile.findUnique({
    where: { id: params.id },
    select: {
      id: true, status: true, transactionSide: true, propertyCategory: true, yearBuilt: true, originatingListingId: true,
      salePrice: true, leasePrice: true,
      saleCommissionPct: true, saleCommissionAmount: true, listingCommissionPct: true, listingCommissionAmount: true,
      checklistItems: { select: { id: true, name: true, isRequired: true, _count: { select: { documents: true } } } },
    },
  });
  if (!file) return NextResponse.json({ error: "Transaction file not found" }, { status: 404 });
  if (FINISHED.has(file.status)) return NextResponse.json({ error: "This file is finished and can't be changed." }, { status: 400 });
  if (file.status === "PENDING_TRANSFER") return NextResponse.json({ error: "This file is locked until its transfer is approved." }, { status: 400 });
  if (!to || !canChangeRepresentation(file.transactionSide, to)) {
    return NextResponse.json({ error: "That change isn't allowed." }, { status: 400 });
  }

  const template = await prisma.checklistTemplate.findFirst({
    where: checklistTemplateWhere("transaction", { transactionSide: to as never, propertyCategory: file.propertyCategory }),
    include: { items: { orderBy: { order: "asc" } } },
  });
  const items = templateItemsForFile(template?.items ?? [], !!file.originatingListingId);
  const rows = file.checklistItems.map((r) => ({ id: r.id, name: r.name, isRequired: r.isRequired, documentCount: r._count.documents }));
  const plan = template
    ? planRepresentationChange(items, rows, file.yearBuilt)
    : { add: [], removeIds: [] as string[], requiredUpdates: [] as { id: string; isRequired: boolean }[] };

  const price = (isLeaseSide(to) ? file.leasePrice : file.salePrice) ?? 0;
  const commission = resolveCommission(to, price, {
    salePct: file.saleCommissionPct, saleAmount: file.saleCommissionAmount,
    listingPct: file.listingCommissionPct, listingAmount: file.listingCommissionAmount,
  });
  const added = plan.add.map((i) => shortItemName(i.name));
  const removed = rows.filter((r) => plan.removeIds.includes(r.id)).map((r) => shortItemName(r.name));

  const results = await prisma.$transaction([
    prisma.transactionFile.update({ where: { id: file.id }, data: { transactionSide: to as never, ...commission } }),
    ...(plan.add.length
      ? [prisma.fileChecklistItem.createMany({ data: checklistCreateData("TRANSACTION", plan.add, file.yearBuilt).map((d) => ({ ...d, transactionFileId: file.id })) })]
      : []),
    ...(plan.removeIds.length ? [prisma.fileChecklistItem.deleteMany({ where: { id: { in: plan.removeIds } } })] : []),
    ...plan.requiredUpdates.map((u) => prisma.fileChecklistItem.update({ where: { id: u.id }, data: { isRequired: u.isRequired } })),
    prisma.fileActivity.create({
      data: {
        fileType: "TRANSACTION", transactionFileId: file.id, listingFileId: null,
        actorId: session.user.id, actorRole: "ADMIN", type: "REPRESENTATION_CHANGED",
        payload: { from: file.transactionSide, to, added, removed },
      },
    }),
  ]);
  return NextResponse.json({ transactionFile: results[0] });
}
