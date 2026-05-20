import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [listings, transactions] = await Promise.all([
    prisma.listingFile.findMany({
      where: { awaitingReview: true },
      include: {
        agent: { include: { user: { select: { name: true, email: true } } } },
        documents: { where: { reviewStatus: "PENDING_REVIEW" } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.transactionFile.findMany({
      where: { awaitingReview: true },
      include: {
        agent: { include: { user: { select: { name: true, email: true } } } },
        documents: { where: { reviewStatus: "PENDING_REVIEW" } },
      },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return NextResponse.json({ listings, transactions });
}
