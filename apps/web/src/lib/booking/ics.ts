import type { MeetingType } from "@cnc/database";
import { BOOKING_CALENDAR_EMAIL, BOOKING_RULES } from "./rules";

// The calendar invite attached to the visitor's booking emails. Google Calendar
// no longer emails the visitor (its invites came "from" our domain without our
// domain's signature, so Outlook/Hotmail sent them to junk); the site's own
// Postmark emails carry this file instead. Every file for one booking shares a
// UID, and each later file has a higher SEQUENCE, so the visitor's calendar
// app moves or removes the one entry rather than adding another.
//
// The UID is the Google event's own iCalUID when there is one. The visitor is
// a guest on Ryan's event, so Gmail users already get Google's copy; sharing
// its UID keeps that and our invite as one entry. Google's iCalUID is
// "<event id>@google.com", unchanged by moves and deletes (checked against the
// live API 2026-11-19; createEvent logs if that ever stops being true).

export type BookingInvite = {
  method: "REQUEST" | "CANCEL";
  bookingId: string;
  /** Ryan's Google event for this booking, when it was created. */
  googleEventId?: string | null;
  /** When the booking last changed (booked, rescheduled or cancelled). Drives SEQUENCE. */
  changedAt: Date;
  startsAt: Date;
  attendeeEmail: string;
  attendeeName: string;
  meetingType: MeetingType;
  meetLink: string | null;
  phone: string;
  manageUrl: string;
};

const ORGANIZER_NAME = "Ryan Chong";
const SUMMARY = "Call with Ryan (CnC Realty)";
// SEQUENCE counts seconds from this date: it only ever goes up, needs no
// database column, and stays below the 32-bit limit calendar apps use until ~2094.
const SEQUENCE_EPOCH = Date.UTC(2026, 0, 1);

export function inviteSequence(changedAt: Date): number {
  return Math.max(0, Math.floor((changedAt.getTime() - SEQUENCE_EPOCH) / 1000));
}

export function inviteUid(i: Pick<BookingInvite, "bookingId" | "googleEventId">): string {
  return i.googleEventId ? `${i.googleEventId}@google.com` : `booking-${i.bookingId}@cncrealtygroup.com`;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Parameter values (CN=...) can't hold a double quote; quote the value when it
// contains a separator.
function paramValue(s: string): string {
  const v = s.replace(/"/g, "'").replace(/[\r\n]/g, " ");
  return /[,;:]/.test(v) ? `"${v}"` : v;
}

// RFC 5545: lines longer than 75 octets continue on the next line after CRLF + space.
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74; // continuation lines spend one octet on the space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function description(i: BookingInvite): string {
  const how =
    i.meetingType === "PHONE"
      ? `Phone call: Ryan will call you at ${i.phone}`
      : i.meetLink
        ? `Google Meet: ${i.meetLink}`
        : "Google Meet";
  return `${how}\n\nReschedule or cancel: ${i.manageUrl}`;
}

function location(i: BookingInvite): string {
  if (i.meetingType === "PHONE") return "Phone call";
  return i.meetLink ?? "Google Meet";
}

export function buildBookingIcs(i: BookingInvite): string {
  const endsAt = new Date(i.startsAt.getTime() + BOOKING_RULES.slotMinutes * 60_000);
  const cancel = i.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CnC Realty//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${i.method}`,
    "BEGIN:VEVENT",
    `UID:${inviteUid(i)}`,
    `SEQUENCE:${inviteSequence(i.changedAt)}`,
    `DTSTAMP:${icsDate(i.changedAt)}`,
    `DTSTART:${icsDate(i.startsAt)}`,
    `DTEND:${icsDate(endsAt)}`,
    `SUMMARY:${escapeText(SUMMARY)}`,
    `DESCRIPTION:${escapeText(description(i))}`,
    `LOCATION:${escapeText(location(i))}`,
    ...(i.meetingType === "MEET" && i.meetLink ? [`URL:${i.meetLink}`] : []),
    `ORGANIZER;CN=${paramValue(ORGANIZER_NAME)}:mailto:${BOOKING_CALENDAR_EMAIL}`,
    `ATTENDEE;CN=${paramValue(i.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${i.attendeeEmail}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The invite as a Postmark attachment (sendEmail's `attachments` entry). */
export function inviteAttachment(i: BookingInvite): { filename: string; content: string; contentType: string } {
  return {
    filename: "invite.ics",
    content: Buffer.from(buildBookingIcs(i), "utf8").toString("base64"),
    contentType: `text/calendar; charset=UTF-8; method=${i.method}`,
  };
}
