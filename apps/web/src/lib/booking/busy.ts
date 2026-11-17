import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { freeBusy, withGoogle } from "@/lib/google-calendar/api";
import { getConnection } from "@/lib/google-calendar/connection";
import type { Interval } from "./slots";

const CACHE_KEY = "booking:busy:v1";
const CACHE_TTL_SECONDS = 60;

export class BookingUnavailableError extends Error {
  constructor(message = "Booking is unavailable") {
    super(message);
    this.name = "BookingUnavailableError";
  }
}

type CachedBusy = { from: string; to: string; busy: { start: string; end: string }[] };

async function readCache(from: Date, to: Date): Promise<Interval[] | null> {
  try {
    const raw = await redis.get<CachedBusy>(CACHE_KEY);
    if (!raw || !Array.isArray(raw.busy)) return null;
    // Cached range must cover the requested range.
    if (new Date(raw.from).getTime() > from.getTime() || new Date(raw.to).getTime() < to.getTime()) return null;
    return raw.busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch {
    return null;
  }
}

async function writeCache(from: Date, to: Date, busy: Interval[]): Promise<void> {
  try {
    const value: CachedBusy = {
      from: from.toISOString(),
      to: to.toISOString(),
      busy: busy.map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString() })),
    };
    await redis.set(CACHE_KEY, value, { ex: CACHE_TTL_SECONDS });
  } catch {
    // Cache is best effort.
  }
}

export async function clearBusyCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // ignore
  }
}

async function googleBusy(from: Date, to: Date, fresh: boolean): Promise<Interval[]> {
  let conn;
  try {
    conn = await getConnection();
  } catch {
    throw new BookingUnavailableError("Stored Google connection is unreadable");
  }
  if (!conn || conn.status !== "connected") throw new BookingUnavailableError("Google Calendar is not connected");

  if (!fresh) {
    const cached = await readCache(from, to);
    if (cached) return cached;
  }
  let busy: Interval[];
  try {
    busy = await withGoogle(() => freeBusy(from, to));
  } catch {
    throw new BookingUnavailableError("Google Calendar request failed");
  }
  await writeCache(from, to, busy);
  return busy;
}

/** Google busy time (60 s cached unless `fresh`) plus active DB bookings (always live). */
export async function getBusy(from: Date, to: Date, opts: { fresh?: boolean } = {}): Promise<Interval[]> {
  const [google, rows] = await Promise.all([
    googleBusy(from, to, opts.fresh === true),
    prisma.booking.findMany({
      where: { status: "ACTIVE", startsAt: { lt: to }, endsAt: { gt: from } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  return [...google, ...rows.map((r) => ({ start: r.startsAt, end: r.endsAt }))];
}
