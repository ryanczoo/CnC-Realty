import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import {
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingRescheduled,
  sendBookingCancelled,
  sendBookingAlert,
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
const invite = { bookingId: "b1", changedAt: new Date("2026-11-16T17:00:00Z") };
const sent = () => vi.mocked(sendEmail).mock.calls[0][0];
const ics = () => {
  const a = sent().attachments;
  expect(a).toHaveLength(1);
  return { ...a![0], text: Buffer.from(a![0].content, "base64").toString("utf8").replace(/\r\n /g, "") };
};
const PHOTO = {
  confirmed: "https://cncrealtygroup.com/meeting-confirmed-photo.jpg",
  moved: "https://cncrealtygroup.com/meeting-moved-photo.jpg",
  cancelled: "https://cncrealtygroup.com/meeting-cancelled-photo.jpg",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://cncrealtygroup.com");
});

// Ryan (2026-11-18): one gold "Manage" button; the Reschedule | Cancel links
// under it went to the same page, so they're gone.
function expectManageButtonOnly(html: string | undefined) {
  html = html ?? "";
  expect(html).toMatch(/>\s*Manage\s*<\/a>/);
  expect(html).not.toContain("Manage my meeting");
  expect(html).toContain(input.manageUrl);
  expect(html).not.toContain(">Reschedule</a>");
  expect(html).not.toContain(">Cancel</a>");
  expect(html).not.toContain("Reschedule or cancel");
}

describe("visitor confirmation", () => {
  it("subject, photo, heading, PT time, Meet, manage button", async () => {
    await sendBookingConfirmation(input, invite);
    const m = sent();
    expect(m.to).toBe("a@b.com");
    expect(m.stream).toBe("transactional");
    expect(m.subject).toBe("Meeting with Ryan confirmed!");
    expect(m.html).toContain(PHOTO.confirmed);
    expect(m.html).toMatch(/You(&#39;|&#x27;|')re booked!/);
    expect(m.html).toContain("Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain("Google Meet");
    expectManageButtonOnly(m.html);
  });

  it("attaches the booking's invite", async () => {
    await sendBookingConfirmation(input, invite);
    const a = ics();
    expect(a.filename).toBe("invite.ics");
    expect(a.contentType).toContain("method=REQUEST");
    expect(a.text).toContain("UID:booking-b1@cncrealtygroup.com");
    expect(a.text).toContain("DTSTART:20261117T181500Z");
    expect(a.text).toContain("mailto:a@b.com");
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
});

describe("visitor rescheduled", () => {
  it("subject, photo, new time, manage button, update invite with the same UID", async () => {
    const moved = { ...input, startsAt: new Date("2026-11-17T19:00:00Z") };
    await sendBookingRescheduled(moved, { ...invite, changedAt: new Date("2026-11-16T18:00:00Z") });
    const m = sent();
    expect(m.to).toBe("a@b.com");
    expect(m.subject).toBe("Meeting with Ryan moved!");
    expect(m.html).toContain(PHOTO.moved);
    expect(m.html).toContain("Your call has moved");
    expect(m.html).toContain("Tue, Nov 17 · 11:00 AM PT");
    expectManageButtonOnly(m.html);
    const a = ics();
    expect(a.contentType).toContain("method=REQUEST");
    expect(a.text).toContain("UID:booking-b1@cncrealtygroup.com");
    expect(a.text).toContain("DTSTART:20261117T190000Z");
  });
});

describe("visitor cancelled", () => {
  it("visitor cancelled: subject, photo, cancel invite, book-again button, no manage link", async () => {
    await sendBookingCancelled(input, { ...invite, changedAt: new Date("2026-11-16T18:00:00Z") });
    const m = sent();
    expect(m.subject).toBe("Meeting with Ryan cancelled!");
    expect(m.html).toContain(PHOTO.cancelled);
    expect(m.html).toContain("Your call is cancelled");
    expect(m.html).toContain("Your call with Ryan has been cancelled.");
    expect(m.html).toContain("Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain("Book a new time");
    expect(m.html).toContain("https://cncrealtygroup.com/contact");
    expect(m.html).not.toContain(input.manageUrl);
    const a = ics();
    expect(a.contentType).toContain("method=CANCEL");
    expect(a.text).toContain("STATUS:CANCELLED");
    expect(a.text).toContain("UID:booking-b1@cncrealtygroup.com");
  });

  it("Ryan cancelled: says Ryan needed to cancel", async () => {
    await sendBookingCancelled(input, invite, "ryan");
    const m = sent();
    expect(m.subject).toBe("Meeting with Ryan cancelled!");
    expect(m.html).toContain("Ryan needed to cancel your call.");
    expect(m.html).not.toContain("Your call with Ryan has been cancelled.");
    expect(ics().contentType).toContain("method=CANCEL");
  });
});

describe("visitor reminders", () => {
  it("subjects", async () => {
    await sendBookingReminder(input, "24h");
    expect(sent().subject).toBe("Reminder: your call with Ryan is tomorrow");
    vi.clearAllMocks();
    await sendBookingReminder(input, "1h");
    expect(sent().subject).toBe("Reminder: your call with Ryan starts in 1 hour");
  });

  it("manage button, no photo, no invite file", async () => {
    await sendBookingReminder(input, "24h");
    expectManageButtonOnly(sent().html);
    expect(sent().html).not.toContain("meeting-");
    expect(sent().attachments).toBeUndefined();
  });
});

describe("sendBookingAlert (to Ryan)", () => {
  const who = {
    leadId: "l1",
    firstName: "Ann",
    lastName: "Lee",
    email: "a@b.com",
    phone: "714-555-0100",
    meetingType: "MEET" as const,
  };
  const OLD = new Date("2026-11-17T18:15:00Z");
  const NEW = new Date("2026-11-17T19:00:00Z");

  it("confirmed: info@, subject, photo, every detail, lead link, no invite", async () => {
    await sendBookingAlert({
      ...who,
      kind: "confirmed",
      startsAt: OLD,
      meetLink: "https://meet.google.com/abc",
      role: "Agent",
      notes: "Looking to switch brokerages",
      bookingSource: "JOIN",
    });
    const m = sent();
    expect(m.to).toBe(NOTIFY);
    expect(m.stream).toBe("transactional");
    expect(m.subject).toBe("Meeting confirmed: Ann Lee · Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain(PHOTO.confirmed);
    for (const s of [
      "Ann Lee",
      "a@b.com",
      "714-555-0100",
      "Tue, Nov 17 · 10:15 AM PT",
      "Google Meet",
      "https://meet.google.com/abc",
      "Agent",
      "Looking to switch brokerages",
      "Join page",
      "Open lead",
      "https://cncrealtygroup.com/dashboard/leads/l1",
    ]) {
      expect(m.html).toContain(s);
    }
    expect(m.attachments).toBeUndefined();
  });

  it("confirmed: leaves out empty optional rows", async () => {
    await sendBookingAlert({
      ...who,
      phone: "",
      meetingType: "PHONE",
      kind: "confirmed",
      startsAt: OLD,
      meetLink: null,
      role: null,
      notes: null,
      bookingSource: "CONTACT",
    });
    const html = sent().html;
    expect(html).not.toContain("<strong>Phone:</strong>");
    expect(html).not.toContain("<strong>I am a:</strong>");
    expect(html).not.toContain("<strong>Message:</strong>");
    expect(html).not.toContain("<strong>Meet link:</strong>");
    expect(html).toContain("Contact page");
  });

  it("moved: subject, photo, old → new time", async () => {
    await sendBookingAlert({ ...who, kind: "moved", oldStartsAt: OLD, newStartsAt: NEW });
    const m = sent();
    expect(m.to).toBe(NOTIFY);
    expect(m.subject).toBe("Meeting moved: Ann Lee · Tue, Nov 17 · 10:15 AM PT → Tue, Nov 17 · 11:00 AM PT");
    expect(m.html).toContain(PHOTO.moved);
    expect(m.html).toContain("Tue, Nov 17 · 11:00 AM PT");
    expect(m.html).toContain("https://cncrealtygroup.com/dashboard/leads/l1");
    expect(m.attachments).toBeUndefined();
  });

  it("cancelled: subject, photo, details", async () => {
    await sendBookingAlert({ ...who, meetingType: "PHONE", kind: "cancelled", oldStartsAt: OLD });
    const m = sent();
    expect(m.subject).toBe("Meeting cancelled: Ann Lee · Tue, Nov 17 · 10:15 AM PT");
    expect(m.html).toContain(PHOTO.cancelled);
    expect(m.html).toContain("Phone call");
    expect(m.html).toContain("https://cncrealtygroup.com/dashboard/leads/l1");
  });

  it("escapes the visitor's details", async () => {
    await sendBookingAlert({ ...who, kind: "cancelled", oldStartsAt: OLD, firstName: "<b>x</b>" });
    expect(sent().html).not.toContain("<b>x</b>");
    expect(sent().html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("detailRowsHtml", () => {
  it("renders bold labels with escaped values", () => {
    expect(detailRowsHtml([["Name", "A & B"]])).toBe("<p><strong>Name:</strong> A &amp; B</p>");
  });
});
