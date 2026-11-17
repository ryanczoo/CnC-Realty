import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendBookingConfirmation, sendBookingReminder } from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";

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
    await sendBookingConfirmation(input);
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
    await sendBookingConfirmation({ ...input, firstName: "<script>alert(1)</script>" });
    expect(sent().html).not.toContain("<script>alert(1)");
    expect(sent().html).toContain("&lt;script&gt;");
  });

  it("meet without link points at the calendar invite", async () => {
    await sendBookingConfirmation({ ...input, meetLink: null });
    expect(sent().html).toContain("Your Google Meet link is in the calendar invite.");
  });

  it("phone call names the number", async () => {
    await sendBookingConfirmation({ ...input, meetingType: "PHONE", meetLink: null });
    expect(sent().html).toContain("Phone call — Ryan will call you at 714-555-0100");
  });

  it("reminder subjects", async () => {
    await sendBookingReminder(input, "24h");
    expect(sent().subject).toBe("Reminder: your call with Ryan is tomorrow");
    vi.clearAllMocks();
    await sendBookingReminder(input, "1h");
    expect(sent().subject).toBe("Reminder: your call with Ryan starts in 1 hour");
  });
});
