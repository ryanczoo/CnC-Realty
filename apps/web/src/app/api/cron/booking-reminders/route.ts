import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { eventExists, withGoogle } from "@/lib/google-calendar/api";
import { reminderDue } from "@/lib/booking/reminders";
import { manageUrl } from "@/lib/booking/tokens";
import { sendBookingReminder, sendBookingCancelled, type BookingEmailInput } from "@/lib/email/booking-emails";
import { sendSafely } from "@/lib/email/send-safely";
import { clearBusyCache } from "@/lib/booking/busy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    include: { lead: { select: { firstName: true, email: true, phone: true } } },
  });

  let sent = 0;
  let cancelled = 0;

  for (const b of bookings) {
    try {
      if (!b.googleEventId) continue;

      const visitor: BookingEmailInput = {
        email: b.lead.email,
        firstName: b.lead.firstName,
        phone: b.lead.phone ?? "",
        startsAt: b.startsAt,
        meetingType: b.meetingType,
        meetLink: b.meetLink,
        manageUrl: manageUrl(b.id),
      };

      let exists: boolean;
      try {
        const id = b.googleEventId;
        exists = await withGoogle(() => eventExists(id));
      } catch (err) {
        console.error("[booking-reminders] Google check failed, skipping", b.id, err);
        continue;
      }

      if (!exists) {
        await prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelledAt: now } });
        await prisma.activity
          .create({
            data: { type: "NOTE", content: "Cancelled the call (removed from Google Calendar)", leadId: b.leadId },
          })
          .catch(console.error);
        cancelled++;
        await clearBusyCache();
        // Same UID, later SEQUENCE: the visitor's calendar removes the entry.
        await sendSafely(() => sendBookingCancelled(visitor, { bookingId: b.id, changedAt: now }, "ryan"));
        continue;
      }

      const which = reminderDue(b, now);
      if (!which) continue;
      await sendBookingReminder(visitor, which);
      await prisma.booking.update({
        where: { id: b.id },
        data: which === "24h" ? { reminder24SentAt: now } : { reminder1SentAt: now },
      });
      sent++;
    } catch (err) {
      console.error("[booking-reminders] failed for booking", b.id, err);
    }
  }

  return NextResponse.json({ sent, cancelled });
}

export const GET = POST;
