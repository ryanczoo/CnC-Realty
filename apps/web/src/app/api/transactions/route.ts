import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const transactions = await prisma.transactionFile.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { include: { documents: true } } },
  });

  return NextResponse.json({ transactions });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const body = await req.json();
  const { propertyAddress, city, state, zip, mlsNumber, transactionSide, listPrice, salePrice, offerDate, acceptanceDate, inspectionDeadline, appraisalDeadline, loanApprovalDeadline, closeOfEscrow, commissionGCI, commissionSplit, commissionNotes, originatingLeadId } = body;

  if (!propertyAddress || !city || !zip || !transactionSide) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const template = await prisma.checklistTemplate.findFirst({
    where: { fileType: "TRANSACTION", isActive: true, OR: [{ transactionSide }, { transactionSide: "ALL" }] },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const tx = await prisma.transactionFile.create({
    data: {
      agentId: agent.id,
      propertyAddress, city, state: state ?? "CA", zip,
      mlsNumber: mlsNumber ?? null,
      transactionSide,
      originatingLeadId: originatingLeadId ?? null,
      listPrice: listPrice ? parseFloat(listPrice) : null,
      salePrice: salePrice ? parseFloat(salePrice) : null,
      offerDate: offerDate ? new Date(offerDate) : null,
      acceptanceDate: acceptanceDate ? new Date(acceptanceDate) : null,
      inspectionDeadline: inspectionDeadline ? new Date(inspectionDeadline) : null,
      appraisalDeadline: appraisalDeadline ? new Date(appraisalDeadline) : null,
      loanApprovalDeadline: loanApprovalDeadline ? new Date(loanApprovalDeadline) : null,
      closeOfEscrow: closeOfEscrow ? new Date(closeOfEscrow) : null,
      commissionGCI: commissionGCI ? parseFloat(commissionGCI) : null,
      commissionSplit: commissionSplit ? parseFloat(commissionSplit) : null,
      commissionNotes: commissionNotes ?? null,
      checklistItems: template ? {
        create: template.items.map((item) => ({
          fileType: "TRANSACTION" as const,
          name: item.name,
          description: item.description,
          order: item.order,
          isRequired: item.isRequired,
        })),
      } : undefined,
      activities: { create: { fileType: "TRANSACTION" as const, actorId: session.user.id, actorRole: "AGENT" as const, type: "FILE_CREATED" as const } },
    },
  });

  return NextResponse.json({ transaction: tx }, { status: 201 });
}
