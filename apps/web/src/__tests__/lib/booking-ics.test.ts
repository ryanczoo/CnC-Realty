import { describe, it, expect } from "vitest";
import { buildBookingIcs, inviteAttachment, inviteSequence, type BookingInvite } from "@/lib/booking/ics";

const base: BookingInvite = {
  method: "REQUEST",
  bookingId: "b1",
  changedAt: new Date("2026-11-16T17:00:00Z"),
  startsAt: new Date("2026-11-17T18:15:00Z"),
  attendeeEmail: "a@b.com",
  attendeeName: "Ann",
  meetingType: "MEET",
  meetLink: "https://meet.google.com/abc-defg-hij",
  phone: "714-555-0100",
  manageUrl: "https://cncrealtygroup.com/booking/manage?t=tok",
};
const lines = (s: string) => s.split("\r\n");
// Unfolds continuation lines so assertions can read whole property values.
const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("buildBookingIcs", () => {
  it("is a CRLF calendar with one event for the booking", () => {
    const ics = buildBookingIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    const l = lines(unfold(ics));
    expect(l).toContain("METHOD:REQUEST");
    expect(l).toContain("UID:booking-b1@cncrealtygroup.com");
    expect(l).toContain("DTSTART:20261117T181500Z");
    expect(l).toContain("DTEND:20261117T183000Z");
    expect(l).toContain("STATUS:CONFIRMED");
    expect(l).toContain("ORGANIZER;CN=Ryan Chong:mailto:ryanchong@cncrealtygroup.com");
    // RSVP=FALSE: Ryan doesn't need "Accepted" reply emails.
    expect(l).toContain("ATTENDEE;CN=Ann;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:a@b.com");
    expect(l).toContain("SUMMARY:Call with Ryan (CnC Realty)");
    expect(l).toContain(`SEQUENCE:${inviteSequence(base.changedAt)}`);
  });

  // Gmail guests already get Google's copy of Ryan's event (they're attendees). Sharing Google's
  // iCalUID (verified 2026-11-19: always "<event id>@google.com", unchanged by moves and deletes)
  // makes our invite the same calendar entry instead of a second one.
  it("uses Google's event UID when the booking has a Google event", () => {
    const l = lines(unfold(buildBookingIcs({ ...base, googleEventId: "9m1fttap1jptqto9p9pdu67dqo" })));
    expect(l).toContain("UID:9m1fttap1jptqto9p9pdu67dqo@google.com");
    expect(l.some((x) => x.startsWith("UID:booking-"))).toBe(false);
  });

  it("falls back to the booking UID when there is no Google event", () => {
    expect(lines(unfold(buildBookingIcs({ ...base, googleEventId: null })))).toContain(
      "UID:booking-b1@cncrealtygroup.com"
    );
  });

  it("Meet call: location and description carry the Meet link and the manage link", () => {
    const u = unfold(buildBookingIcs(base));
    expect(lines(u)).toContain("LOCATION:https://meet.google.com/abc-defg-hij");
    expect(u).toContain("Google Meet: https://meet.google.com/abc-defg-hij");
    expect(u).toContain("Reschedule or cancel: https://cncrealtygroup.com/booking/manage?t=tok");
  });

  it("Meet call without a link yet says so", () => {
    const u = unfold(buildBookingIcs({ ...base, meetLink: null }));
    expect(lines(u)).toContain("LOCATION:Google Meet");
  });

  it("phone call: Ryan will call the visitor's number", () => {
    const u = unfold(buildBookingIcs({ ...base, meetingType: "PHONE", meetLink: null }));
    expect(lines(u)).toContain("LOCATION:Phone call");
    expect(u).toContain("Ryan will call you at 714-555-0100");
  });

  it("cancel keeps the same UID and marks the event cancelled", () => {
    const l = lines(unfold(buildBookingIcs({ ...base, method: "CANCEL" })));
    expect(l).toContain("METHOD:CANCEL");
    expect(l).toContain("STATUS:CANCELLED");
    expect(l).toContain("UID:booking-b1@cncrealtygroup.com");
  });

  it("escapes commas, semicolons, backslashes and newlines in text", () => {
    const u = unfold(buildBookingIcs({ ...base, meetingType: "PHONE", meetLink: null, phone: "1,2;3\\4\n5" }));
    expect(u).toContain("Ryan will call you at 1\\,2\\;3\\\\4\\n5");
  });

  it("quotes an attendee name with special characters", () => {
    const u = unfold(buildBookingIcs({ ...base, attendeeName: 'Ann, "Jr"; x:y' }));
    expect(lines(u)).toContain("ATTENDEE;CN=\"Ann, 'Jr'; x:y\";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:a@b.com");
  });

  it("folds every line to at most 75 octets", () => {
    const long = { ...base, manageUrl: `https://cncrealtygroup.com/booking/manage?t=${"x".repeat(200)}` };
    for (const line of lines(buildBookingIcs(long))) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(unfold(buildBookingIcs(long))).toContain(long.manageUrl);
  });
});

describe("inviteSequence", () => {
  it("goes up with each later change and stays a 32-bit integer", () => {
    const a = inviteSequence(new Date("2026-11-17T00:00:00Z"));
    const b = inviteSequence(new Date("2026-11-17T00:00:01Z"));
    expect(Number.isInteger(a)).toBe(true);
    expect(b).toBeGreaterThan(a);
    // Seconds since 2026 stay under the 32-bit limit until ~2094.
    expect(inviteSequence(new Date("2090-12-31T00:00:00Z"))).toBeLessThan(2 ** 31);
  });
});

describe("inviteAttachment", () => {
  it("is invite.ics, base64 of the calendar, with the method in the content type", () => {
    const a = inviteAttachment({ ...base, method: "CANCEL" });
    expect(a.filename).toBe("invite.ics");
    expect(a.contentType).toBe("text/calendar; charset=UTF-8; method=CANCEL");
    expect(Buffer.from(a.content, "base64").toString("utf8")).toBe(buildBookingIcs({ ...base, method: "CANCEL" }));
  });
});
