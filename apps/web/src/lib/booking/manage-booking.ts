import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { clearBusyCache, getBusy, BookingUnavailableError } from "./busy";
import { moveEvent, deleteEvent, withGoogle } from "@/lib/google-calendar/api";
import { isOpenSlot } from "./slots";
import { formatSlotPT } from "./format";
import { BOOKING_RULES } from "./rules";

export type ManageView = { status: "ACTIVE" | "CANCELLED"; startsAt: string; meetingType: string; firstName: string };

export type RescheduleResult =
  | { ok: true; startsAt: Date }
  | { ok: false; reason: "taken" | "cancelled" | "unavailable" | "not_found" };

function findBooking(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: { lead: { select: { firstName: true } } } });
}

export async function getManageView(bookingId: string): Promise<ManageView | null> {
  const b = await findBooking(bookingId);
  if (!b) return null;
  return {
    status: b.status,
    startsAt: b.startsAt.toISOString(),
    meetingType: b.meetingType,
    firstName: b.lead.firstName,
  };
}

/** Google problems never undo or fail the DB change. */
async function googleSafely(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await withGoogle(fn);
  } catch (err) {
    console.error(`[booking/manage] Google ${label} failed`, err);
    Sentry.captureException(err);
  }
}

export async function cancelBooking(bookingId: string, now: Date = new Date()): Promise<boolean> {
  const b = await findBooking(bookingId);
  if (!b) return false;
  if (b.status === "CANCELLED") return true;

  await prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelledAt: now } });
  if (b.googleEventId) {
    const eventId = b.googleEventId;
    await googleSafely("delete", () => deleteEvent(eventId));
  }
  await prisma.activity
    .create({ data: { type: "NOTE", content: "Cancelled the call", leadId: b.leadId } })
    .catch(console.error);
  await clearBusyCache();
  return true;
}

export async function rescheduleBooking(
  bookingId: string,
  startsAt: Date,
  now: Date = new Date()
): Promise<RescheduleResult> {
  const b = await findBooking(bookingId);
  if (!b) return { ok: false, reason: "not_found" };
  if (b.status === "CANCELLED") return { ok: false, reason: "cancelled" };

  const endsAt = new Date(startsAt.getTime() + BOOKING_RULES.slotMinutes * 60_000);

  let busy;
  try {
    busy = await getBusy(startsAt, endsAt, { fresh: true, excludeBookingId: b.id });
  } catch (err) {
    if (err instanceof BookingUnavailableError) return { ok: false, reason: "unavailable" };
    throw err;
  }
  // Google still lists this booking's own event; drop it so the visitor can move by any amount.
  busy = busy.filter(
    (i) => !(i.start.getTime() === b.startsAt.getTime() && i.end.getTime() === b.endsAt.getTime())
  );
  if (!isOpenSlot(startsAt, now, busy)) return { ok: false, reason: "taken" };

  try {
    await prisma.booking.update({
      where: { id: b.id },
      data: { startsAt, endsAt, scheduledAt: now, reminder24SentAt: null, reminder1SentAt: null },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return { ok: false, reason: "taken" };
    throw err;
  }

  if (b.googleEventId) {
    const eventId = b.googleEventId;
    await googleSafely("move", () => moveEvent(eventId, startsAt, endsAt));
  }
  await prisma.activity
    .create({
      data: { type: "NOTE", content: `Rescheduled to ${formatSlotPT(startsAt)}`, leadId: b.leadId },
    })
    .catch(console.error);
  await clearBusyCache();
  return { ok: true, startsAt };
}
