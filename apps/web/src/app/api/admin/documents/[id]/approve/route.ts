import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReadyToClose } from "@/lib/transaction-helpers";
import { sendAllDocsApproved } from "@/lib/email/transaction-emails";
import { clearedListingSentinels } from "@/lib/transfer-placeholder";

const TEMPLATE_ITEMS_INCLUDE = { items: { orderBy: { order: "asc" as const } } };

function templateItemsCreate(
  fileType: "LISTING" | "TRANSACTION",
  template: { items: { name: string; description: string | null; order: number; isRequired: boolean }[] } | null
) {
  if (!template || template.items.length === 0) return undefined;
  return {
    create: template.items.map((item) => ({
      fileType,
      name: item.name,
      description: item.description,
      order: item.order,
      isRequired: item.isRequired,
    })),
  };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileDocument.update({
    where: { id: params.id },
    data: { reviewStatus: "APPROVED", reviewedByAdminId: session.user.id, reviewedAt: new Date() },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: doc.fileType,
      listingFileId: doc.listingFileId,
      transactionFileId: doc.transactionFileId,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "DOCUMENT_APPROVED",
      payload: { documentId: doc.id, name: doc.name },
    },
  });

  // Unlocking a PENDING_TRANSFER placeholder. This block fires exactly once per file:
  // the guard is the status itself, which this same update moves off PENDING_TRANSFER.
  // Alongside the status flip it must (a) seed the real compliance checklist the
  // placeholder never had — without it `isReadyToClose` is true immediately and the
  // file could be closed with zero compliance documents — and (b) clear the creation
  // sentinels, which no other screen in the app can ever correct.
  let unlocked = false;

  if (doc.checklistItemId) {
    if (doc.fileType === "LISTING") {
      const parent = await prisma.listingFile.findUnique({
        where: { id: doc.listingFileId! },
        select: { status: true, listingType: true, propertyAddress: true, city: true, zip: true },
      });
      if (parent?.status === "PENDING_TRANSFER") {
        const template = await prisma.checklistTemplate.findFirst({
          where: {
            fileType: "LISTING",
            isActive: true,
            OR: [{ listingType: parent.listingType }, { listingType: "ALL" }],
          },
          include: TEMPLATE_ITEMS_INCLUDE,
        });

        // updateMany (rather than update) guards this write with the status
        // itself, so a concurrent change to this same file between the read
        // above and this write can't double-apply the template or double-log
        // the transition — .count is the source of truth for whether this
        // request actually performed the unlock. Prisma's updateMany can't
        // carry a nested relation write, so a matched template's items are
        // created separately, gated on the same .count > 0 result below.
        const result = await prisma.listingFile.updateMany({
          where: { id: doc.listingFileId!, status: "PENDING_TRANSFER" },
          data: {
            status: "INCOMPLETE",
            ...clearedListingSentinels(parent),
          },
        });

        if (result.count > 0) {
          unlocked = true;
          const itemsCreate = templateItemsCreate("LISTING", template);
          if (itemsCreate) {
            await prisma.fileChecklistItem.createMany({
              data: itemsCreate.create.map((item) => ({ ...item, listingFileId: doc.listingFileId! })),
            });
          }
        }
      }
    } else {
      const parent = await prisma.transactionFile.findUnique({
        where: { id: doc.transactionFileId! },
        select: { status: true, transactionSide: true, propertyCategory: true },
      });
      if (parent?.status === "PENDING_TRANSFER") {
        const template = await prisma.checklistTemplate.findFirst({
          where: {
            fileType: "TRANSACTION",
            isActive: true,
            OR: [{ transactionSide: parent.transactionSide }, { transactionSide: "ALL" }],
            AND: [{ OR: [{ propertyCategory: parent.propertyCategory }, { propertyCategory: "ALL" }] }],
          },
          include: TEMPLATE_ITEMS_INCLUDE,
        });

        const result = await prisma.transactionFile.updateMany({
          where: { id: doc.transactionFileId!, status: "PENDING_TRANSFER" },
          data: { status: "INCOMPLETE" },
        });

        if (result.count > 0) {
          unlocked = true;
          const itemsCreate = templateItemsCreate("TRANSACTION", template);
          if (itemsCreate) {
            await prisma.fileChecklistItem.createMany({
              data: itemsCreate.create.map((item) => ({ ...item, transactionFileId: doc.transactionFileId! })),
            });
          }
        }
      }
    }
  }

  if (unlocked) {
    await prisma.fileActivity.create({
      data: {
        fileType: doc.fileType,
        listingFileId: doc.listingFileId,
        transactionFileId: doc.transactionFileId,
        actorId: session.user.id,
        actorRole: "ADMIN",
        type: "STATUS_CHANGED",
        payload: { from: "PENDING_TRANSFER", to: "INCOMPLETE" },
      },
    });
  }

  const fileId = doc.listingFileId ?? doc.transactionFileId!;
  const isListing = doc.fileType === "LISTING";

  const checklistItems = await prisma.fileChecklistItem.findMany({
    where: isListing ? { listingFileId: fileId } : { transactionFileId: fileId },
    include: { documents: true },
  });

  if (isReadyToClose(checklistItems)) {
    const fileRecord = isListing
      ? await prisma.listingFile.findUnique({ where: { id: fileId }, select: { propertyAddress: true, city: true, state: true, zip: true, agent: { select: { user: { select: { email: true, name: true } } } } } })
      : await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { propertyAddress: true, city: true, state: true, zip: true, agent: { select: { user: { select: { email: true, name: true } } } } } });

    if (fileRecord?.agent?.user) {
      await sendAllDocsApproved({
        agentEmail: fileRecord.agent.user.email,
        agentName: fileRecord.agent.user.name ?? "Agent",
        address: fileRecord.propertyAddress,
        city: fileRecord.city,
        state: fileRecord.state,
        zip: fileRecord.zip,
        fileType: isListing ? "listing" : "transaction",
        fileId,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
