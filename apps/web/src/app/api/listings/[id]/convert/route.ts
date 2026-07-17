import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (listing.agentId !== session.user.agentId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transactionSide = listing.listingType === "RESIDENTIAL_LEASE" || listing.listingType === "COMMERCIAL_LEASE"
    ? "LEASE_LANDLORD"
    : "LISTING";
  const propertyCategory = listing.listingType.startsWith("COMMERCIAL") ? "COMMERCIAL" : "RESIDENTIAL";

  const template = await prisma.checklistTemplate.findFirst({
    where: {
      fileType: "TRANSACTION",
      isActive: true,
      OR: [{ transactionSide }, { transactionSide: "ALL" }],
      AND: [{ OR: [{ propertyCategory }, { propertyCategory: "ALL" }] }],
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const actorRole = session.user.role === "ADMIN" ? "ADMIN" as const : "AGENT" as const;

  const [txFile] = await prisma.$transaction([
    prisma.transactionFile.create({
      data: {
        agentId: listing.agentId,
        originatingListingId: listing.id,
        propertyAddress: listing.propertyAddress,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        mlsNumber: listing.mlsNumber,
        transactionSide,
        propertyCategory,
        listPrice: listing.listPrice,
        checklistItems: template ? {
          create: template.items.map((item) => ({
            fileType: "TRANSACTION" as const,
            name: item.name,
            description: item.description,
            order: item.order,
            isRequired: item.isRequired,
          })),
        } : undefined,
        activities: {
          create: {
            fileType: "TRANSACTION" as const,
            actorId: session.user.id,
            actorRole,
            type: "FILE_CREATED" as const,
            payload: { convertedFromListingId: listing.id },
          },
        },
      },
    }),
    prisma.listingFile.update({
      where: { id: listing.id },
      data: { status: "ACTIVE_UNDER_CONTRACT" },
    }),
  ]);

  await prisma.fileActivity.create({
    data: {
      fileType: "LISTING",
      listingFileId: listing.id,
      actorId: session.user.id,
      actorRole,
      type: "CONVERTED_TO_TRANSACTION",
      payload: { transactionFileId: txFile.id },
    },
  });

  return NextResponse.json({ transactionFile: txFile }, { status: 201 });
}
