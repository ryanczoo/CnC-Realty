import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";

// Date-driven statuses (SkySlope-style), run once each morning by the
// listing-expiration-warnings cron. Incomplete listings are never touched: the
// agent decides when a new listing is ready. Each change is logged as automatic,
// attributed to the file's agent (every activity needs a user).

// Today's Pacific calendar date as UTC midnight — the way date-only fields
// (listDate, expirationDate, closeOfEscrow) are stored.
export function pacificToday(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

type Candidate = { id: string; status: string; agent: { userId: string } | null };

async function applyAll(kind: "listing" | "transaction", files: Candidate[], to: string): Promise<number> {
  let changed = 0;
  for (const f of files) {
    if (!f.agent) continue;
    try {
      const update = kind === "listing"
        ? prisma.listingFile.update({ where: { id: f.id }, data: { status: to as never } })
        : prisma.transactionFile.update({ where: { id: f.id }, data: { status: to as never } });
      await prisma.$transaction([
        update,
        prisma.fileActivity.create({
          data: {
            fileType: kind === "listing" ? "LISTING" : "TRANSACTION",
            listingFileId: kind === "listing" ? f.id : null,
            transactionFileId: kind === "transaction" ? f.id : null,
            actorId: f.agent.userId,
            actorRole: "AGENT",
            type: "STATUS_CHANGED",
            payload: { from: f.status, to, automatic: true },
          },
        }),
      ]);
      changed++;
    } catch (err) {
      Sentry.captureException(err, { extra: { kind, fileId: f.id, to } });
    }
  }
  return changed;
}

export async function runAutoStatus(now: Date) {
  const today = pacificToday(now);
  const select = { id: true, status: true, agent: { select: { userId: true } } } as const;

  // Expiration first: a listing whose whole period has passed goes straight to
  // Expired, and the activation query below skips anything already expired.
  const [toExpire, toActivate, txToExpire, txToReopen] = await Promise.all([
    prisma.listingFile.findMany({ where: { status: { in: ["ACTIVE", "COMING_SOON"] }, expirationDate: { lt: today } }, select }),
    prisma.listingFile.findMany({
      where: { status: "COMING_SOON", listDate: { lte: today }, OR: [{ expirationDate: null }, { expirationDate: { gte: today } }] },
      select,
    }),
    prisma.transactionFile.findMany({ where: { status: "PENDING", closeOfEscrow: { lt: today } }, select }),
    prisma.transactionFile.findMany({ where: { status: "EXPIRED", closeOfEscrow: { gte: today } }, select }),
  ]);

  return {
    listingsExpired: await applyAll("listing", toExpire as Candidate[], "EXPIRED"),
    listingsActivated: await applyAll("listing", toActivate as Candidate[], "ACTIVE"),
    transactionsExpired: await applyAll("transaction", txToExpire as Candidate[], "EXPIRED"),
    transactionsReopened: await applyAll("transaction", txToReopen as Candidate[], "PENDING"),
  };
}
