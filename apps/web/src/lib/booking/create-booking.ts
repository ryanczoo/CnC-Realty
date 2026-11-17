import * as Sentry from "@sentry/nextjs";
import type { Booking, BookingSource } from "@cnc/database";
import { prisma } from "@/lib/prisma";
import { applyTag } from "@/lib/tags";
import { leadCreateData, afterLeadCreated, type WebsiteLeadInput } from "@/lib/leads/create-lead";
import { createEvent, withGoogle } from "@/lib/google-calendar/api";
import { getBusy, clearBusyCache, BookingUnavailableError } from "./busy";
import { isOpenSlot, type Interval } from "./slots";
import { BOOKING_RULES } from "./rules";
import { formatSlotPT } from "./format";
import { manageUrl } from "./tokens";
import { sendSafely } from "@/lib/email/send-safely";
import { sendEmail } from "@/lib/email/send";
import { NOTIFY, emailLayout, buildHeadingBodyHtml, escapeHtml } from "@/lib/email";
import { sendBookingConfirmation } from "@/lib/email/booking-emails";
import { eventSummary, eventDescription } from "./event-text";

export type BookingInput = WebsiteLeadInput & {
  startsAt: Date;
  meetingType: "PHONE" | "MEET";
  bookingSource: BookingSource;
  newsletterConsent: boolean;
};

export type CreateBookingResult =
  | { ok: true; booking: Booking; manageUrl: string }
  | { ok: false; reason: "taken" | "unavailable" };

export async function createBooking(input: BookingInput, now: Date = new Date()): Promise<CreateBookingResult> {
  const { startsAt, meetingType, bookingSource, newsletterConsent, ...leadInput } = input;
  const endsAt = new Date(startsAt.getTime() + BOOKING_RULES.slotMinutes * 60_000);

  // 1. Re-check the slot against live (uncached) busy time.
  let busy: Interval[];
  try {
    busy = await getBusy(startsAt, endsAt, { fresh: true });
  } catch (err) {
    if (err instanceof BookingUnavailableError) return { ok: false, reason: "unavailable" };
    throw err;
  }
  if (!isOpenSlot(startsAt, now, busy)) return { ok: false, reason: "taken" };

  // 2. Lead + booking together; the DB unique index settles races.
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({ data: leadCreateData(leadInput) });
      const booking = await tx.booking.create({
        data: { leadId: lead.id, startsAt, endsAt, meetingType, source: bookingSource },
      });
      return { lead, booking };
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return { ok: false, reason: "taken" };
    throw err;
  }
  const { lead } = created;
  let booking: Booking = created.booking;

  // 3. Google event. A failure keeps the booking and the CRM lead.
  const text = { ...leadInput, meetingType, bookingSource };
  try {
    const event = await withGoogle(() =>
      createEvent({
        bookingId: booking.id,
        start: startsAt,
        end: endsAt,
        summary: eventSummary(text),
        description: eventDescription(text),
        attendeeEmail: leadInput.email,
        meet: meetingType === "MEET",
        location: meetingType === "PHONE" && leadInput.phone ? `Phone: ${leadInput.phone}` : undefined,
      })
    );
    await prisma.booking.update({
      where: { id: booking.id },
      data: { googleEventId: event.id, meetLink: event.meetLink },
    });
    booking = { ...booking, googleEventId: event.id, meetLink: event.meetLink };
  } catch (err) {
    console.error(`[booking] Google event creation failed for booking ${booking.id} (no event id)`, err);
    Sentry.captureException(err);
    const name = `${lead.firstName} ${lead.lastName}`.trim();
    const when = formatSlotPT(startsAt);
    const row = (k: string, v: string) => `<p><strong>${k}:</strong> ${escapeHtml(v)}</p>`;
    await sendSafely(() =>
      sendEmail({
        to: NOTIFY,
        subject: `Booking needs a calendar event: ${name} ${when}`,
        html: emailLayout({
          bodyHtml: buildHeadingBodyHtml({
            heading: "Booking needs a calendar event",
            bodyHtml:
              row("Name", name) +
              row("Email", lead.email) +
              row("Phone", lead.phone ?? "") +
              row("Time", when) +
              row("Meeting type", meetingType === "MEET" ? "Google Meet" : "Phone call") +
              "<p>Google Calendar didn't accept this booking — please add it to your calendar and send the invite.</p>",
          }),
        }),
        stream: "transactional",
      })
    );
  }

  // 4. Tags (never fail the booking).
  await applyTag(lead.id, "Booked Call").catch(console.error);
  if (bookingSource === "RECRUITING_EMAIL") await applyTag(lead.id, "Recruiting Email").catch(console.error);

  // 5. Activity note.
  const label = meetingType === "MEET" ? "Google Meet" : "Phone call";
  await prisma.activity
    .create({
      data: {
        type: "NOTE",
        content: `Booked a ${BOOKING_RULES.slotMinutes}-min call for ${formatSlotPT(startsAt)} (${label})`,
        leadId: lead.id,
      },
    })
    .catch(console.error);

  // 6. Notification + newsletter; 7. drop the busy cache.
  await afterLeadCreated(lead, { newsletterConsent });
  await clearBusyCache();

  const url = manageUrl(booking.id);
  await sendSafely(() =>
    sendBookingConfirmation({
      email: lead.email,
      firstName: lead.firstName,
      phone: lead.phone ?? "",
      startsAt,
      meetingType,
      meetLink: booking.meetLink,
      manageUrl: url,
    })
  );

  return { ok: true, booking, manageUrl: url };
}
