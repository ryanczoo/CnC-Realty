import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminder } from "@/lib/deadline-email";
import { TransactionFileStatus } from "@cnc/database";

export const maxDuration = 60;

const REMIND_AT_DAYS = [1, 3];

function windowFor(daysFromNow: number): { gte: Date; lte: Date } {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windows = REMIND_AT_DAYS.map(windowFor);

  const files = await prisma.transactionFile.findMany({
    where: {
      status: { not: TransactionFileStatus.CLOSED },
      OR: windows.flatMap((w) => [
        { closeOfEscrow: w },
        { inspectionDeadline: w },
        { appraisalDeadline: w },
        { loanApprovalDeadline: w },
      ]),
    },
    select: {
      id: true,
      propertyAddress: true,
      closeOfEscrow: true,
      inspectionDeadline: true,
      appraisalDeadline: true,
      loanApprovalDeadline: true,
      agent: { select: { user: { select: { name: true, email: true } } } },
    },
    take: 200,
  });

  const now = Date.now();

  const reminders = files.flatMap((t) =>
    [
      { label: "Close of Escrow", date: t.closeOfEscrow },
      { label: "Inspection", date: t.inspectionDeadline },
      { label: "Appraisal", date: t.appraisalDeadline },
      { label: "Loan Approval", date: t.loanApprovalDeadline },
    ]
      .filter((d) => {
        if (!d.date || !t.agent?.user?.email) return false;
        const daysOut = Math.round((d.date.getTime() - now) / 86_400_000);
        return REMIND_AT_DAYS.includes(daysOut);
      })
      .map((d) => ({
        agentEmail: t.agent!.user!.email!,
        agentName: t.agent!.user!.name ?? null,
        address: t.propertyAddress ?? "Unknown address",
        label: d.label,
        date: d.date!,
        daysOut: Math.round((d.date!.getTime() - now) / 86_400_000),
      }))
  );

  await Promise.allSettled(reminders.map((r) => sendDeadlineReminder(r)));

  return NextResponse.json({ sent: reminders.length });
}
