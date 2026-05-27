import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { TransactionFileStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEADLINE_WINDOW_DAYS = 7;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "AGENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + DEADLINE_WINDOW_DAYS);

  const where = {
    status: { not: TransactionFileStatus.CLOSED },
    OR: [
      { closeOfEscrow: { gte: now, lte: cutoff } },
      { inspectionDeadline: { gte: now, lte: cutoff } },
      { appraisalDeadline: { gte: now, lte: cutoff } },
      { loanApprovalDeadline: { gte: now, lte: cutoff } },
    ],
    ...(session.user.role !== "ADMIN" && { agentId: session.user.id }),
  };

  const files = await prisma.transactionFile.findMany({
    where,
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      closeOfEscrow: true,
      inspectionDeadline: true,
      appraisalDeadline: true,
      loanApprovalDeadline: true,
      agent: { select: { user: { select: { name: true, email: true } } } },
    },
    take: 200,
  });

  const deadlines = files.flatMap((t) =>
    [
      { label: "Close of Escrow", date: t.closeOfEscrow },
      { label: "Inspection", date: t.inspectionDeadline },
      { label: "Appraisal", date: t.appraisalDeadline },
      { label: "Loan Approval", date: t.loanApprovalDeadline },
    ]
      .filter((d) => d.date && d.date >= now && d.date <= cutoff)
      .map((d) => ({
        transactionId: t.id,
        address: t.propertyAddress,
        label: d.label,
        date: d.date,
        agentName: t.agent?.user?.name ?? null,
        agentEmail: t.agent?.user?.email ?? null,
        daysOut: Math.ceil((d.date!.getTime() - Date.now()) / 86_400_000),
      }))
  );

  deadlines.sort((a, b) => a.daysOut - b.daysOut);

  return NextResponse.json({ deadlines });
}
