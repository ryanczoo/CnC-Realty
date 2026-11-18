import type { MeetingType } from "@cnc/database";
import { emailLayout, buildHeadingBodyHtml, escapeHtml, NOTIFY } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { formatSlotPT } from "@/lib/booking/format";
import { inviteAttachment } from "@/lib/booking/ics";

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
export type InviteRef = { bookingId: string; changedAt: Date };

type Attachment = ReturnType<typeof inviteAttachment>;

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

function manageLinksHtml(url: string): string {
  const href = escapeHtml(url);
  return `<p style="text-align: center; font-size: 16px; margin: 20px 0 0;">
    <a href="${href}" style="color: #9E8C61;">Reschedule</a> &nbsp;|&nbsp; <a href="${href}" style="color: #9E8C61;">Cancel</a>
  </p>`;
}

function invite(b: BookingEmailInput, ref: InviteRef, method: "REQUEST" | "CANCEL"): Attachment {
  return inviteAttachment({
    method,
    bookingId: ref.bookingId,
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

async function send(
  b: BookingEmailInput,
  subject: string,
  heading: string,
  intro: string,
  attachment?: Attachment
): Promise<void> {
  const bodyHtml = buildHeadingBodyHtml({
    heading,
    bodyHtml: `<p>Hi ${escapeHtml(b.firstName)},</p><p>${intro}</p>${detailsHtml(b)}`,
  });
  await sendEmail({
    to: b.email,
    subject,
    html: emailLayout({
      bodyHtml,
      ctaLabel: "Reschedule or cancel",
      ctaHref: b.manageUrl,
      afterCtaHtml: manageLinksHtml(b.manageUrl),
    }),
    stream: "transactional",
    ...(attachment ? { attachments: [attachment] } : {}),
  });
}

export async function sendBookingConfirmation(b: BookingEmailInput, ref: InviteRef): Promise<void> {
  await send(
    b,
    "You're booked: your call with Ryan",
    "You're booked!",
    "Your call with Ryan is confirmed.",
    invite(b, ref, "REQUEST")
  );
}

export async function sendBookingRescheduled(b: BookingEmailInput, ref: InviteRef): Promise<void> {
  await send(
    b,
    "Your call with Ryan has moved",
    "Your call has moved",
    "Your call with Ryan is now at the new time below.",
    invite(b, ref, "REQUEST")
  );
}

export async function sendBookingCancelled(b: BookingEmailInput, ref: InviteRef): Promise<void> {
  const bodyHtml = buildHeadingBodyHtml({
    heading: "Your call is cancelled",
    bodyHtml:
      `<p>Hi ${escapeHtml(b.firstName)},</p>` +
      `<p>Your call with Ryan has been cancelled.</p>` +
      `<p><strong>${escapeHtml(formatSlotPT(b.startsAt))}</strong></p>` +
      `<p>Want to talk another time? Pick a new time whenever you're ready.</p>`,
  });
  await sendEmail({
    to: b.email,
    subject: "Your call with Ryan is cancelled",
    html: emailLayout({ bodyHtml, ctaLabel: "Book a new time", ctaHref: `${process.env.NEXTAUTH_URL}/contact` }),
    stream: "transactional",
    attachments: [invite(b, ref, "CANCEL")],
  });
}

export async function sendBookingReminder(b: BookingEmailInput, which: "24h" | "1h"): Promise<void> {
  if (which === "24h") {
    await send(b, "Reminder: your call with Ryan is tomorrow", "Your call is tomorrow", "A quick reminder about your call with Ryan.");
  } else {
    await send(b, "Reminder: your call with Ryan starts in 1 hour", "Your call starts in 1 hour", "Your call with Ryan starts in about an hour.");
  }
}

export type BookingChangeAlert = {
  leadId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  meetingType: MeetingType;
  oldStartsAt: Date;
} & ({ kind: "moved"; newStartsAt: Date } | { kind: "cancelled" });

/** Heads-up to Ryan (info@) when a visitor reschedules or cancels from their manage link. */
export async function sendBookingChangeAlert(a: BookingChangeAlert): Promise<void> {
  const name = `${a.firstName} ${a.lastName}`.trim();
  const oldWhen = formatSlotPT(a.oldStartsAt);
  const moved = a.kind === "moved";
  const newWhen = moved ? formatSlotPT(a.newStartsAt) : "";
  const subject = moved ? `Call moved: ${name} · ${oldWhen} → ${newWhen}` : `Call cancelled: ${name} · ${oldWhen}`;
  const timeRows: [string, string][] = moved ? [["Was", oldWhen], ["Now", newWhen]] : [["Time", oldWhen]];
  const rows: [string, string][] = [
    ["Name", name],
    ["Email", a.email],
    ...(a.phone ? ([["Phone", a.phone]] as [string, string][]) : []),
    ...timeRows,
    ["Meeting type", meetingLabel(a.meetingType)],
  ];
  const bodyHtml = buildHeadingBodyHtml({
    heading: moved ? "Call moved" : "Call cancelled",
    bodyHtml:
      detailRowsHtml(rows) +
      (moved ? "<p>Your Google Calendar has been updated.</p>" : "<p>The time is open again on the site.</p>"),
  });
  await sendEmail({
    to: NOTIFY,
    subject,
    html: emailLayout({
      bodyHtml,
      ctaLabel: "Open lead",
      ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/leads/${encodeURIComponent(a.leadId)}`,
    }),
    stream: "transactional",
  });
}
