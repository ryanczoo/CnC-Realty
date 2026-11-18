import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import {
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingRescheduled,
  sendBookingCancelled,
  sendBookingChangeAlert,
  detailRowsHtml,
} from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { NOTIFY } from "@/lib/email";

const input = {
  email: "a@b.com",
  firstName: "Ann",
  phone: "714-555-0100",
  startsAt: new Date("2026-11-17T18:15:00Z"), // 10:15 AM PT
  meetingType: "MEET" as const,
  meetLink: "https://meet.google.com/abc-defg-hij",
  manageUrl: "https://cncrealtygroup.com/booking/manage?t=tok",
};
const sent = () => vi.mocked(sendEmail).mock.calls[0][0];

describe("booking emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_URL", "https://cncrealtygroup.com");
  });

  it("confirmation has heading, PT time, manage URL, Reschedule and Cancel", async () => {
    await sendBookingConfirmation(input, invite);
    const m = sent();
    expect(m.to).toBe("a@b.com");
    expect(m.stream).toBe("transactional");
    expect(m.html).toMatch(/You(&#39;|&#x27;|')re booked!/);
    expect(m.html).toContain("Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain(input.manageUrl);
    expect(m.html).toContain("Reschedule");
    expect(m.html).toContain("Cancel");
    expect(m.html).toContain("Google Meet");
  });

  it("escapes the visitor's name", async () => {
    await sendBookingConfirmation({ ...input, firstName: "<script>alert(1)</script>" }, invite);
    expect(sent().html).not.toContain("<script>alert(1)");
    expect(sent().html).toContain("&lt;script&gt;");
  });

  // Google no longer emails its own invite, so a missing link can't be "in the calendar invite".
  it("meet without link says Ryan will send it", async () => {
    await sendBookingConfirmation({ ...input, meetLink: null }, invite);
    expect(sent().html).toContain("Ryan will email you the Google Meet link before the call.");
    expect(sent().html).not.toContain("in the calendar invite");
  });

  it("phone call names the number", async () => {
    await sendBookingConfirmation({ ...input, meetingType: "PHONE", meetLink: null }, invite);
    expect(sent().html).toContain("Phone call — Ryan will call you at 714-555-0100");
  });

  it("reminder subjects", async () => {
    await sendBookingReminder(input, "24h");
    expect(sent().subject).toBe("Reminder: your call with Ryan is tomorrow");
    vi.clearAllMocks();
    await sendBookingReminder(input, "1h");
    expect(sent().subject).toBe("Reminder: your call with Ryan starts in 1 hour");
  });

  it("reminders carry no invite file", async () => {
    await sendBookingReminder(input, "24h");
    expect(sent().attachments).toBeUndefined();
  });
});

const invite = { bookingId: "b1", changedAt: new Date("2026-11-16T17:00:00Z") };
const ics = () => {
  const a = sent().attachments;
  expect(a).toHaveLength(1);
  return { ...a![0], text: Buffer.from(a![0].content, "base64").toString("utf8").replace(/\r\n /g, "") };
};

describe("calendar invite on visitor emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_URL", "https://cncrealtygroup.com");
  });

  it("confirmation attaches the booking's invite", async () => {
    await sendBookingConfirmation(input, invite);
    const a = ics();
    expect(a.filename).toBe("invite.ics");
    expect(a.contentType).toContain("method=REQUEST");
    expect(a.text).toContain("UID:booking-b1@cncrealtygroup.com");
    expect(a.text).toContain("DTSTART:20261117T181500Z");
    expect(a.text).toContain("mailto:a@b.com");
  });

  it("rescheduled email: new time, update invite with the same UID, manage links", async () => {
    const moved = { ...input, startsAt: new Date("2026-11-17T19:00:00Z") };
    await sendBookingRescheduled(moved, { ...invite, changedAt: new Date("2026-11-16T18:00:00Z") });
    const m = sent();
    expect(m.to).toBe("a@b.com");
    expect(m.subject).toBe("Your call with Ryan has moved");
    expect(m.html).toContain("Your call has moved");
    expect(m.html).toContain("Tue, Nov 17 · 11:00 AM PT");
    expect(m.html).toContain(input.manageUrl);
    const a = ics();
    expect(a.contentType).toContain("method=REQUEST");
    expect(a.text).toContain("UID:booking-b1@cncrealtygroup.com");
    expect(a.text).toContain("DTSTART:20261117T190000Z");
  });

  it("cancelled email: cancel invite, book-again button, no reschedule links", async () => {
    await sendBookingCancelled(input, { ...invite, changedAt: new Date("2026-11-16T18:00:00Z") });
    const m = sent();
    expect(m.subject).toBe("Your call with Ryan is cancelled");
    expect(m.html).toContain("Your call is cancelled");
    expect(m.html).toContain("Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain("Book a new time");
    expect(m.html).toContain("https://cncrealtygroup.com/contact");
    expect(m.html).not.toContain(input.manageUrl);
    const a = ics();
    expect(a.contentType).toContain("method=CANCEL");
    expect(a.text).toContain("STATUS:CANCELLED");
    expect(a.text).toContain("UID:booking-b1@cncrealtygroup.com");
  });
});

describe("sendBookingChangeAlert (to Ryan)", () => {
  const alert = {
    leadId: "l1",
    firstName: "Ann",
    lastName: "Lee",
    email: "a@b.com",
    phone: "714-555-0100",
    meetingType: "MEET" as const,
    oldStartsAt: new Date("2026-11-17T18:15:00Z"),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_URL", "https://cncrealtygroup.com");
  });

  it("moved: goes to info@, old → new time, lead link, no invite", async () => {
    await sendBookingChangeAlert({ ...alert, kind: "moved", newStartsAt: new Date("2026-11-17T19:00:00Z") });
    const m = sent();
    expect(m.to).toBe(NOTIFY);
    expect(m.stream).toBe("transactional");
    expect(m.subject).toBe("Call moved: Ann Lee · Tue, Nov 17 · 10:15 AM PT → Tue, Nov 17 · 11:00 AM PT");
    expect(m.html).toContain("a@b.com");
    expect(m.html).toContain("714-555-0100");
    expect(m.html).toContain("Google Meet");
    expect(m.html).toContain("Open lead");
    expect(m.html).toContain("https://cncrealtygroup.com/dashboard/leads/l1");
    expect(m.attachments).toBeUndefined();
  });

  it("cancelled: subject and details", async () => {
    await sendBookingChangeAlert({ ...alert, kind: "cancelled", meetingType: "PHONE" });
    const m = sent();
    expect(m.subject).toBe("Call cancelled: Ann Lee · Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain("Phone call");
    expect(m.html).toContain("https://cncrealtygroup.com/dashboard/leads/l1");
  });

  it("escapes the visitor's details", async () => {
    await sendBookingChangeAlert({ ...alert, kind: "cancelled", firstName: "<b>x</b>" });
    expect(sent().html).not.toContain("<b>x</b>");
    expect(sent().html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("detailRowsHtml", () => {
  it("renders bold labels with escaped values", () => {
    expect(detailRowsHtml([["Name", "A & B"]])).toBe("<p><strong>Name:</strong> A &amp; B</p>");
  });
});
