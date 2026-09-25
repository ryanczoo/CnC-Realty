import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { isLeaseSide } from "@/types/transaction";

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

type DateInput = Date | string | null | undefined;
const asTime = (d: DateInput) => (d ? new Date(d).getTime() : null);

// The one date-driven status rule, used by the morning job and by every detail
// save. Returns the status a file should move to because of its dates, or null.
// Listings: Coming Soon -> Active on the list date; Active/Coming Soon -> Expired
// after the expiration date; Expired -> Active when the expiration moves out.
// Transactions key on close of escrow (sales) or lease start date (leases):
// Pending -> Expired once it passes, Expired -> Pending when it moves out.
// Incomplete files are never touched — the agent decides when they're ready.
export function dateDrivenStatus(
  f: {
    kind: "listing" | "transaction";
    status: string;
    transactionSide?: string | null;
    listDate?: DateInput;
    expirationDate?: DateInput;
    closeOfEscrow?: DateInput;
    leaseStartDate?: DateInput;
  },
  today: Date,
): string | null {
  const now = today.getTime();
  if (f.kind === "listing") {
    const exp = asTime(f.expirationDate);
    const list = asTime(f.listDate);
    if ((f.status === "ACTIVE" || f.status === "COMING_SOON") && exp !== null && exp < now) return "EXPIRED";
    if (f.status === "COMING_SOON" && list !== null && list <= now) return "ACTIVE";
    if (f.status === "EXPIRED" && exp !== null && exp >= now) return "ACTIVE";
    return null;
  }
  const key = asTime(isLeaseSide(f.transactionSide) ? f.leaseStartDate : f.closeOfEscrow);
  if (key === null) return null;
  if (f.status === "PENDING" && key < now) return "EXPIRED";
  if (f.status === "EXPIRED" && key >= now) return "PENDING";
  return null;
}

type Candidate ={ id: string; status: string; agent: { userId: string } | null };

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
