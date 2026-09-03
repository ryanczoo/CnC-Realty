import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFileExpirationWarning } from "@/lib/email/transaction-emails";

export const maxDuration = 60;

const REMIND_AT_DAYS = 7;

// A single calendar day, not "anytime in the next N days" -- a fixed date is
// only ever exactly N days from today on one specific day, so this window
// naturally sends at most one warning per listing with no "already sent"
// tracking needed, run once daily. Same technique as deadline-reminders.
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

  const listings = await prisma.listingFile.findMany({
    where: {
      status: "ACTIVE",
      expirationDate: windowFor(REMIND_AT_DAYS),
    },
    select: {
      id: true,
      propertyAddress: true,
      city: true,
      state: true,
      zip: true,
      agent: { select: { user: { select: { name: true, email: true } } } },
    },
    take: 200,
  });

  const warnings = listings.filter((l) => l.agent?.user?.email);

  await Promise.allSettled(
    warnings.map((l) =>
      sendFileExpirationWarning({
        agentEmail: l.agent!.user!.email!,
        agentName: l.agent!.user!.name ?? "",
        address: l.propertyAddress,
        city: l.city,
        state: l.state,
        zip: l.zip,
        expiresInDays: REMIND_AT_DAYS,
        fileType: "listing",
        fileId: l.id,
      })
    )
  );

  return NextResponse.json({ sent: warnings.length });
}
