import type { BookingSource, MeetingType } from "@cnc/database";
import { emailLayout, buildHeadingBodyHtml, escapeHtml, NOTIFY } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { formatSlotPT } from "@/lib/booking/format";
import { inviteAttachment } from "@/lib/booking/ics";
import { SOURCE_LABEL } from "@/lib/booking/event-text";

export type BookingEmailInput = {
  email: string;
  firstName: string;
  phone: string;
  startsAt: Date;
  meetingType: MeetingType;
  meetLink: string | null;
  manageUrl: string;
};

/** Which booking a calendar invite belongs to, and when it last changed (orders the updates). */
export type InviteRef = { bookingId: string; changedAt: Date; googleEventId?: string | null };

type Attachment = ReturnType<typeof inviteAttachment>;

// One photo per moment, shared by the visitor's email and Ryan's alert (Ryan, 2026-11-18).
type Moment = "confirmed" | "moved" | "cancelled";
function photoUrl(m: Moment): string {
  return `${process.env.NEXTAUTH_URL}/meeting-${m}-photo.jpg`;
}

/** Bold "Label: value" lines for Ryan's booking alerts. Values are escaped. */
export function detailRowsHtml(rows: [string, string][]): string {
  return rows.map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("");
}

function meetingLabel(t: MeetingType): string {
  return t === "MEET" ? "Google Meet" : "Phone call";
}

function detailsHtml(b: BookingEmailInput): string {
  const when = `<p><strong>${escapeHtml(formatSlotPT(b.startsAt))}</strong></p>`;
  if (b.meetingType === "PHONE") {
    return `${when}<p>Phone call — Ryan will call you at ${escapeHtml(b.phone)}</p>`;
  }
  const link = b.meetLink
    ? `<p>Google Meet: <a href="${escapeHtml(b.meetLink)}" style="color: #9E8C61;">${escapeHtml(b.meetLink)}</a></p>`
    : `<p>Ryan will email you the Google Meet link before the call.</p>`;
  return `${when}<p>Google Meet</p>${link}`;
}

function invite(b: BookingEmailInput, ref: InviteRef, method: "REQUEST" | "CANCEL"): Attachment {
  return inviteAttachment({
    method,
    bookingId: ref.bookingId,
    googleEventId: ref.googleEventId,
    changedAt: ref.changedAt,
    startsAt: b.startsAt,
    attendeeEmail: b.email,
    attendeeName: b.firstName,
    meetingType: b.meetingType,
    meetLink: b.meetLink,
    phone: b.phone,
    manageUrl: b.manageUrl,
  });
}

// The visitor's booked/moved/reminder emails: details plus one "Manage" button,
// which opens the manage page (pick a new time or cancel).
async function send(
  b: BookingEmailInput,
  opts: { subject: string; heading: string; intro: string; moment?: Moment; attachment?: Attachment }
): Promise<void> {
  const bodyHtml = buildHeadingBodyHtml({
    heading: opts.heading,
    bodyHtml: `<p>Hi ${escapeHtml(b.firstName)},</p><p>${opts.intro}</p>${detailsHtml(b)}`,
    ...(opts.moment ? { photoUrl: photoUrl(opts.moment) } : {}),
  });
  await sendEmail({
    to: b.email,
    subject: opts.subject,
    html: emailLayout({ bodyHtml, ctaLabel: "Manage", ctaHref: escapeHtml(b.manageUrl) }),
    stream: "transactional",
    ...(opts.attachment ? { attachments: [opts.attachment] } : {}),
  });
}

export async function sendBookingConfirmation(b: BookingEmailInput, ref: InviteRef): Promise<void> {
  await send(b, {
    subject: "Meeting with Ryan confirmed!",
    heading: "You're booked!",
    intro: "Your call with Ryan is confirmed.",
    moment: "confirmed",
    attachment: invite(b, ref, "REQUEST"),
  });
}

export async function sendBookingRescheduled(b: BookingEmailInput, ref: InviteRef): Promise<void> {
  await send(b, {
    subject: "Meeting with Ryan moved!",
    heading: "Your call has moved",
    intro: "Your call with Ryan is now at the new time below.",
    moment: "moved",
    attachment: invite(b, ref, "REQUEST"),
  });
}

/** cancelledBy "ryan": Ryan deleted the event from his calendar, so the wording says he cancelled. */
export async function sendBookingCancelled(
  b: BookingEmailInput,
  ref: InviteRef,
  cancelledBy: "visitor" | "ryan" = "visitor"
): Promise<void> {
  const intro = cancelledBy === "ryan" ? "Ryan needed to cancel your call." : "Your call with Ryan has been cancelled.";
  const bodyHtml = buildHeadingBodyHtml({
    heading: "Your call is cancelled",
    photoUrl: photoUrl("cancelled"),
    bodyHtml:
      `<p>Hi ${escapeHtml(b.firstName)},</p>` +
      `<p>${intro}</p>` +
      `<p><strong>${escapeHtml(formatSlotPT(b.startsAt))}</strong></p>` +
      `<p>Want to talk another time? Pick a new time whenever you're ready.</p>`,
  });
  await sendEmail({
    to: b.email,
    subject: "Meeting with Ryan cancelled!",
    html: emailLayout({ bodyHtml, ctaLabel: "Book a new time", ctaHref: `${process.env.NEXTAUTH_URL}/contact` }),
    stream: "transactional",
    attachments: [invite(b, ref, "CANCEL")],
  });
}

export async function sendBookingReminder(b: BookingEmailInput, which: "24h" | "1h"): Promise<void> {
  if (which === "24h") {
    await send(b, {
      subject: "Reminder: your call with Ryan is tomorrow",
      heading: "Your call is tomorrow",
      intro: "A quick reminder about your call with Ryan.",
    });
  } else {
    await send(b, {
      subject: "Reminder: your call with Ryan starts in 1 hour",
      heading: "Your call starts in 1 hour",
      intro: "Your call with Ryan starts in about an hour.",
    });
  }
}

type AlertPerson = {
  leadId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  meetingType: MeetingType;
};

export type BookingAlert = AlertPerson &
  (
    | {
        kind: "confirmed";
        startsAt: Date;
        meetLink: string | null;
        role?: string | null;
        notes?: string | null;
        bookingSource: BookingSource;
      }
    | { kind: "moved"; oldStartsAt: Date; newStartsAt: Date }
    | { kind: "cancelled"; oldStartsAt: Date }
  );

const ALERT_TITLE: Record<Moment, string> = {
  confirmed: "Meeting confirmed",
  moved: "Meeting moved",
  cancelled: "Meeting cancelled",
};

/** Ryan's alert (info@) when a visitor books, reschedules, or cancels. */
export async function sendBookingAlert(a: BookingAlert): Promise<void> {
  const name = `${a.firstName} ${a.lastName}`.trim();
  const optional = (label: string, v: string | null | undefined): [string, string][] => (v ? [[label, v]] : []);

  let when: string;
  let timeRows: [string, string][];
  let extraRows: [string, string][] = [];
  let note: string;
  if (a.kind === "confirmed") {
    when = formatSlotPT(a.startsAt);
    timeRows = [["Time", when]];
    extraRows = [
      ...optional("Meet link", a.meetingType === "MEET" ? a.meetLink : null),
      ...optional("I am a", a.role),
      ...optional("Message", a.notes),
      ["Booked from", SOURCE_LABEL[a.bookingSource]],
    ];
    note = "It's on your Google Calendar.";
  } else if (a.kind === "moved") {
    const oldWhen = formatSlotPT(a.oldStartsAt);
    const newWhen = formatSlotPT(a.newStartsAt);
    when = `${oldWhen} → ${newWhen}`;
    timeRows = [["Was", oldWhen], ["Now", newWhen]];
    note = "Your Google Calendar has been updated.";
  } else {
    when = formatSlotPT(a.oldStartsAt);
    timeRows = [["Time", when]];
    note = "The time is open again on the site.";
  }

  const rows: [string, string][] = [
    ["Name", name],
    ["Email", a.email],
    ...optional("Phone", a.phone),
    ...timeRows,
    ["Meeting type", meetingLabel(a.meetingType)],
    ...extraRows,
  ];
  const bodyHtml = buildHeadingBodyHtml({
    heading: ALERT_TITLE[a.kind],
    photoUrl: photoUrl(a.kind),
    bodyHtml: detailRowsHtml(rows) + `<p>${note}</p>`,
  });
  await sendEmail({
    to: NOTIFY,
    subject: `${ALERT_TITLE[a.kind]}: ${name} · ${when}`,
    html: emailLayout({
      bodyHtml,
      ctaLabel: "Open lead",
      ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/leads/${encodeURIComponent(a.leadId)}`,
    }),
    stream: "transactional",
  });
}

/**
 * Safety brake alert (info@): the 15-minute check found every upcoming call missing from Google at
 * once, which looks like a Google problem rather than Ryan deleting them, so nothing was cancelled.
 */
export async function sendMissingEventsAlert(
  calls: { firstName: string; lastName: string; email: string; startsAt: Date }[]
): Promise<void> {
  const rows: [string, string][] = calls.map((c) => [
    formatSlotPT(c.startsAt),
    `${c.firstName} ${c.lastName}`.trim() + ` (${c.email})`,
  ]);
  const bodyHtml = buildHeadingBodyHtml({
    heading: "Booked calls missing from your calendar",
    bodyHtml:
      `<p>All ${calls.length} upcoming booked calls are missing from your Google Calendar at the same time. ` +
      `That usually means a Google problem, not deleted calls, so none were cancelled and no clients were emailed.</p>` +
      detailRowsHtml(rows) +
      `<p>If you deleted them on purpose, they still need cancelling on the site so each client is told. ` +
      `Otherwise check Settings → Google Calendar. This alert repeats at most once a day while it lasts.</p>`,
  });
  await sendEmail({
    to: NOTIFY,
    subject: `Check needed: ${calls.length} booked calls are missing from your Google Calendar`,
    html: emailLayout({ bodyHtml, ctaLabel: "Open Settings", ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/settings` }),
    stream: "transactional",
  });
}
