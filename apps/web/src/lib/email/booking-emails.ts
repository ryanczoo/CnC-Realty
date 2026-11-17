import type { MeetingType } from "@cnc/database";
import { emailLayout, buildHeadingBodyHtml, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { formatSlotPT } from "@/lib/booking/format";

export type BookingEmailInput = {
  email: string;
  firstName: string;
  phone: string;
  startsAt: Date;
  meetingType: MeetingType;
  meetLink: string | null;
  manageUrl: string;
};

function detailsHtml(b: BookingEmailInput): string {
  const when = `<p><strong>${escapeHtml(formatSlotPT(b.startsAt))}</strong></p>`;
  if (b.meetingType === "PHONE") {
    return `${when}<p>Phone call — Ryan will call you at ${escapeHtml(b.phone)}</p>`;
  }
  const link = b.meetLink
    ? `<p>Google Meet: <a href="${escapeHtml(b.meetLink)}" style="color: #9E8C61;">${escapeHtml(b.meetLink)}</a></p>`
    : `<p>Your Google Meet link is in the calendar invite.</p>`;
  return `${when}<p>Google Meet</p>${link}`;
}

function manageLinksHtml(url: string): string {
  const href = escapeHtml(url);
  return `<p style="text-align: center; font-size: 16px; margin: 20px 0 0;">
    <a href="${href}" style="color: #9E8C61;">Reschedule</a> &nbsp;|&nbsp; <a href="${href}" style="color: #9E8C61;">Cancel</a>
  </p>`;
}

async function send(b: BookingEmailInput, subject: string, heading: string, intro: string): Promise<void> {
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
  });
}

export async function sendBookingConfirmation(b: BookingEmailInput): Promise<void> {
  await send(b, "You're booked: your call with Ryan", "You're booked!", "Your call with Ryan is confirmed.");
}

export async function sendBookingReminder(b: BookingEmailInput, which: "24h" | "1h"): Promise<void> {
  if (which === "24h") {
    await send(b, "Reminder: your call with Ryan is tomorrow", "Your call is tomorrow", "A quick reminder about your call with Ryan.");
  } else {
    await send(b, "Reminder: your call with Ryan starts in 1 hour", "Your call starts in 1 hour", "Your call with Ryan starts in about an hour.");
  }
}
