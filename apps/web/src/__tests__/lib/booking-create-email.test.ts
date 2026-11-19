import { describe, it, expect, beforeEach, vi } from "vitest";

const booking = {
  id: "b1",
  leadId: "l1",
  startsAt: new Date("2026-11-17T18:15:00Z"),
  meetingType: "MEET",
  scheduledAt: new Date("2026-11-16T00:00:05Z"),
};
const lead = { id: "l1", firstName: "Ann", lastName: "L", email: "a@b.com", phone: "714" };

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async () => ({ lead, booking })),
    booking: { update: vi.fn().mockResolvedValue({}) },
    activity: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/tags", () => ({ applyTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/leads/create-lead", () => ({ leadCreateData: vi.fn(() => ({})), afterLeadCreated: vi.fn() }));
vi.mock("@/lib/google-calendar/api", () => ({
  createEvent: vi.fn().mockResolvedValue({ id: "ev", meetLink: "https://meet.google.com/x" }),
  withGoogle: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/booking/busy", () => ({
  getBusy: vi.fn().mockResolvedValue([]),
  clearBusyCache: vi.fn(),
  BookingUnavailableError: class extends Error {},
}));
vi.mock("@/lib/booking/slots", () => ({ isOpenSlot: vi.fn(() => true) }));
vi.mock("@/lib/booking/tokens", () => ({ manageUrl: () => "https://x/manage" }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/email/booking-emails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/booking-emails")>()),
  sendBookingConfirmation: vi.fn(),
  sendBookingAlert: vi.fn(),
}));

import { createBooking } from "@/lib/booking/create-booking";
import { sendBookingConfirmation, sendBookingAlert } from "@/lib/email/booking-emails";
import { afterLeadCreated } from "@/lib/leads/create-lead";
import { createEvent } from "@/lib/google-calendar/api";
import { sendEmail } from "@/lib/email/send";

const input = {
  firstName: "Ann",
  lastName: "L",
  email: "a@b.com",
  phone: "714",
  role: "Agent",
  notes: "hi",
  startsAt: booking.startsAt,
  meetingType: "MEET" as const,
  bookingSource: "JOIN" as never,
  newsletterConsent: true,
} as never;

describe("createBooking confirmation email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends one confirmation", async () => {
    const r = await createBooking(input, new Date("2026-11-16T00:00:00Z"));
    expect(r.ok).toBe(true);
    expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
  });

  it("the confirmation carries the booking's calendar invite reference", async () => {
    await createBooking(input, new Date("2026-11-16T00:00:00Z"));
    expect(vi.mocked(sendBookingConfirmation).mock.calls[0][1]).toEqual({
      bookingId: "b1",
      changedAt: booking.scheduledAt,
    });
  });

  // Ryan gets "Meeting confirmed" instead of the general New Lead email (2026-11-18).
  it("skips the New Lead email and sends Ryan the Meeting confirmed alert", async () => {
    await createBooking(input, new Date("2026-11-16T00:00:00Z"));
    expect(vi.mocked(afterLeadCreated).mock.calls[0][1]).toEqual({ newsletterConsent: true, notifyRyan: false });
    expect(sendBookingAlert).toHaveBeenCalledTimes(1);
    expect(sendBookingAlert).toHaveBeenCalledWith({
      kind: "confirmed",
      leadId: "l1",
      firstName: "Ann",
      lastName: "L",
      email: "a@b.com",
      phone: "714",
      meetingType: "MEET",
      startsAt: booking.startsAt,
      meetLink: "https://meet.google.com/x",
      role: "Agent",
      notes: "hi",
      bookingSource: "JOIN",
    });
  });

  it("a failed Meeting confirmed alert never fails the booking", async () => {
    vi.mocked(sendBookingAlert).mockRejectedValueOnce(new Error("smtp"));
    const r = await createBooking(input, new Date("2026-11-16T00:00:00Z"));
    expect(r.ok).toBe(true);
    expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
  });

  it("an email failure never fails the booking", async () => {
    vi.mocked(sendBookingConfirmation).mockRejectedValueOnce(new Error("smtp"));
    const r = await createBooking(input, new Date("2026-11-16T00:00:00Z"));
    expect(r.ok).toBe(true);
  });

  it("emails Ryan once when the Google event fails, booking still ok", async () => {
    vi.mocked(createEvent).mockRejectedValueOnce(new Error("403"));
    const r = await createBooking(input, new Date("2026-11-16T00:00:00Z"));
    expect(r.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(sendEmail).mock.calls[0][0] as { subject: string; html: string };
    expect(arg.subject).toContain("Booking needs a calendar event: Ann L");
    expect(arg.html).toContain("Google Calendar didn't accept this booking");
  });
});
