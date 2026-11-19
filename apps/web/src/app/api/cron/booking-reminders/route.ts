import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { eventExists, withGoogle } from "@/lib/google-calendar/api";
import { reminderDue } from "@/lib/booking/reminders";
import { manageUrl } from "@/lib/booking/tokens";
import {
  sendBookingReminder,
  sendBookingCancelled,
  sendMissingEventsAlert,
  type BookingEmailInput,
} from "@/lib/email/booking-emails";
import { sendSafely } from "@/lib/email/send-safely";
import { clearBusyCache } from "@/lib/booking/busy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Safety brake: this many or more calls missing at once, and that's every call checked, looks like a
// Google problem (or the wrong calendar), not Ryan deleting them. Cancel none; alert Ryan once a day.
const BRAKE_MIN_MISSING = 3;
const BRAKE_ALERT_KEY = "booking:missing-events-alerted";

// Every 15 minutes: checks every upcoming booking's Google event (one small lookup each), so a call
// Ryan deletes from his calendar is cancelled and the visitor emailed within 15 minutes; then sends
// any 24h / 1h reminder that's due.
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: { status: "ACTIVE", startsAt: { gt: now } },
    include: { lead: { select: { firstName: true, lastName: true, email: true, phone: true } } },
  });
  type Row = (typeof bookings)[number];

  const visitor = (b: Row): BookingEmailInput => ({
    email: b.lead.email,
    firstName: b.lead.firstName,
    phone: b.lead.phone ?? "",
    startsAt: b.startsAt,
    meetingType: b.meetingType,
    meetLink: b.meetLink,
    manageUrl: manageUrl(b.id),
  });

  // 1. Check every booking's Google event. Google errors skip the booking entirely (never cancel).
  //    Bookings with no Google event (creation failed) skip the check but still get reminders.
  const missing: Row[] = [];
  const present: Row[] = [];
  let checked = 0;
  for (const b of bookings) {
    if (!b.googleEventId) {
      present.push(b);
      continue;
    }
    try {
      const id = b.googleEventId;
      const exists = await withGoogle(() => eventExists(id));
      checked++;
      (exists ? present : missing).push(b);
    } catch (err) {
      console.error("[booking-reminders] Google check failed, skipping", b.id, err);
    }
  }

  // 2. Safety brake.
  let held = 0;
  if (missing.length >= BRAKE_MIN_MISSING && missing.length === checked) {
    held = missing.length;
    console.error(`[booking-reminders] safety brake: all ${held} checked bookings missing from Google; cancelling none`);
    // At most once a day; if Redis is down, alert anyway (a duplicate beats silence).
    let firstToday = true;
    try {
      firstToday = (await redis.set(BRAKE_ALERT_KEY, now.toISOString(), { nx: true, ex: 86_400 })) === "OK";
    } catch (err) {
      console.error("[booking-reminders] brake alert dedupe failed", err);
    }
    if (firstToday) {
      await sendSafely(() =>
        sendMissingEventsAlert(
          missing.map((b) => ({
            firstName: b.lead.firstName,
            lastName: b.lead.lastName,
            email: b.lead.email,
            startsAt: b.startsAt,
          }))
        )
      );
    }
  }

  // 3. Cancel calls Ryan deleted. Only an ACTIVE booking flips, so a visitor cancelling at the same
  //    moment gets one email, not a second one saying Ryan cancelled.
  let cancelled = 0;
  if (!held) {
    for (const b of missing) {
      try {
        const { count } = await prisma.booking.updateMany({
          where: { id: b.id, status: "ACTIVE" },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        if (count === 0) continue;
        cancelled++;
        await prisma.activity
          .create({
            data: { type: "NOTE", content: "Cancelled the call (removed from Google Calendar)", leadId: b.leadId },
          })
          .catch(console.error);
        await clearBusyCache();
        // Same UID, later SEQUENCE: the visitor's calendar removes the entry.
        await sendSafely(() =>
          sendBookingCancelled(visitor(b), { bookingId: b.id, changedAt: now, googleEventId: b.googleEventId }, "ryan")
        );
      } catch (err) {
        console.error("[booking-reminders] cancel failed for booking", b.id, err);
      }
    }
  }

  // 4. Reminders.
  let sent = 0;
  for (const b of present) {
    try {
      const which = reminderDue(b, now);
      if (!which) continue;
      await sendBookingReminder(visitor(b), which);
      await prisma.booking.update({
        where: { id: b.id },
        data: which === "24h" ? { reminder24SentAt: now } : { reminder1SentAt: now },
      });
      sent++;
    } catch (err) {
      console.error("[booking-reminders] reminder failed for booking", b.id, err);
    }
  }

  return NextResponse.json({ sent, cancelled, held });
}

export const GET = POST;
