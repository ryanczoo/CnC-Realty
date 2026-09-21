import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Every agent's files, for the admin "All Files" tab. The agent-facing
// GET /api/listings and GET /api/transactions only return the caller's own files.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const include = {
    checklistItems: { select: { isRequired: true, documents: { select: { reviewStatus: true } } } },
    agent: { include: { user: { select: { name: true, email: true } } } },
  } as const;

  const [listings, transactions] = await Promise.all([
    prisma.listingFile.findMany({ orderBy: { createdAt: "desc" }, take: 200, include }),
    prisma.transactionFile.findMany({ orderBy: { createdAt: "desc" }, take: 200, include }),
  ]);

  return NextResponse.json({ listings, transactions });
}
