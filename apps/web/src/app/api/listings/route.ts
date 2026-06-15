import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const listings = await prisma.listingFile.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { include: { documents: true } } },
  });

  return NextResponse.json({ listings });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const body = await req.json();
  const { propertyAddress, city, state, zip, mlsNumber, listPrice, listingType, expirationDate, listDate, commissionPercent, commissionNotes } = body;

  if (!propertyAddress || !city || !zip || !listPrice || !listingType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const template = await prisma.checklistTemplate.findFirst({
    where: { fileType: "LISTING", isActive: true, OR: [{ listingType }, { listingType: "ALL" }] },
    include: { items: { orderBy: { order: "asc" } } },
  });

  try {
    const listing = await prisma.listingFile.create({
      data: {
        agentId: agent.id,
        propertyAddress, city, state: state ?? "CA", zip,
        mlsNumber: mlsNumber ?? null,
        listPrice: parseFloat(listPrice),
        listingType,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        listDate: listDate ? new Date(listDate) : null,
        commissionPercent: commissionPercent ? parseFloat(commissionPercent) : null,
        commissionNotes: commissionNotes ?? null,
        checklistItems: template ? {
          create: template.items.map((item) => ({
            fileType: "LISTING" as const,
            name: item.name,
            description: item.description,
            order: item.order,
            isRequired: item.isRequired,
          })),
        } : undefined,
        activities: {
          create: {
            fileType: "LISTING" as const,
            actorId: session.user.id,
            actorRole: "AGENT" as const,
            type: "FILE_CREATED" as const,
          },
        },
      },
    });
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    console.error("[listings POST] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
