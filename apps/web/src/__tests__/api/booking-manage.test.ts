import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    activity: { create: vi.fn() },
  },
}));
vi.mock("@/lib/public-rate-limit", () => ({ checkPublicRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/booking/busy", () => ({
  getBusy: vi.fn().mockResolvedValue([]),
  clearBusyCache: vi.fn().mockResolvedValue(undefined),
  BookingUnavailableError: class BookingUnavailableError extends Error {},
}));
vi.mock("@/lib/google-calendar/api", () => ({
  moveEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  withGoogle: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/booking/tokens", () => ({
  verifyManageToken: vi.fn((t: string) => (t === "good" ? "b1" : null)),
  manageUrl: vi.fn((id: string) => `https://x/manage/${id}`),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/booking-emails", () => ({
  sendBookingRescheduled: vi.fn().mockResolvedValue(undefined),
  sendBookingCancelled: vi.fn().mockResolvedValue(undefined),
  sendBookingAlert: vi.fn().mockResolvedValue(undefined),
}));

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getBusy, clearBusyCache, BookingUnavailableError } from "@/lib/booking/busy";
import { moveEvent, deleteEvent } from "@/lib/google-calendar/api";
import { GET, POST } from "@/app/api/booking/manage/route";
import { sendBookingRescheduled, sendBookingCancelled, sendBookingAlert } from "@/lib/email/booking-emails";

const NOW = new Date("2026-11-16T17:00:00Z");
const OLD = { start: new Date("2026-11-17T18:15:00Z"), end: new Date("2026-11-17T18:30:00Z") };
const NEW_SLOT = "2026-11-17T19:00:00.000Z";

function booking(over: object = {}) {
  return {
    id: "b1",
    leadId: "l1",
    status: "ACTIVE",
    startsAt: OLD.start,
    endsAt: OLD.end,
    meetingType: "MEET",
    googleEventId: "g1",
    meetLink: "https://meet.google.com/abc",
    lead: { firstName: "Jordan", lastName: "Reyes", email: "j@r.co", phone: "714-555-0100" },
    ...over,
  };
}
const visitor = (startsAt: Date) => ({
  email: "j@r.co",
  firstName: "Jordan",
  phone: "714-555-0100",
  startsAt,
  meetingType: "MEET",
  meetLink: "https://meet.google.com/abc",
  manageUrl: "https://x/manage/b1",
});
const alertBase = {
  leadId: "l1",
  firstName: "Jordan",
  lastName: "Reyes",
  email: "j@r.co",
  phone: "714-555-0100",
  meetingType: "MEET",
  oldStartsAt: OLD.start,
};
function post(body: object) {
  return POST(
    new Request("http://x/api/booking/manage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(prisma.booking.findUnique).mockResolvedValue(booking() as never);
  vi.mocked(prisma.booking.update).mockResolvedValue({} as never);
  vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never);
  vi.mocked(getBusy).mockResolvedValue([]);
  vi.mocked(moveEvent).mockResolvedValue(undefined);
  vi.mocked(deleteEvent).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe("GET /api/booking/manage", () => {
  it("returns only status, startsAt, meetingType, firstName", async () => {
    const res = await GET(new Request("http://x/api/booking/manage?t=good"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ACTIVE",
      startsAt: OLD.start.toISOString(),
      meetingType: "MEET",
      firstName: "Jordan",
    });
  });
  it("bad token -> 404", async () => {
    const res = await GET(new Request("http://x/api/booking/manage?t=bad"));
    expect(res.status).toBe(404);
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });
  it("unknown booking -> 404", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);
    expect((await GET(new Request("http://x/api/booking/manage?t=good"))).status).toBe(404);
  });
});

describe("POST tampered token", () => {
  it("404 and no DB write", async () => {
    const res = await post({ t: "tampered", action: "cancel" });
    expect(res.status).toBe(404);
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.activity.create).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
  });
});

describe("POST cancel", () => {
  it("cancels, deletes the event, logs activity, clears cache", async () => {
    const res = await post({ t: "good", action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "CANCELLED" });
    // Only an ACTIVE booking flips, so a second, simultaneous cancel is a no-op.
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: NOW },
    });
    expect(deleteEvent).toHaveBeenCalledWith("g1");
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { type: "NOTE", content: "Cancelled the call", leadId: "l1" },
    });
    expect(clearBusyCache).toHaveBeenCalled();
  });

  it("emails the visitor a cancel invite and alerts Ryan, once each", async () => {
    await post({ t: "good", action: "cancel" });
    expect(sendBookingCancelled).toHaveBeenCalledTimes(1);
    expect(sendBookingCancelled).toHaveBeenCalledWith(visitor(OLD.start), { bookingId: "b1", changedAt: NOW, googleEventId: "g1" });
    expect(sendBookingAlert).toHaveBeenCalledTimes(1);
    expect(sendBookingAlert).toHaveBeenCalledWith({ ...alertBase, kind: "cancelled" });
  });

  it("an email failure does not fail the cancel", async () => {
    vi.mocked(sendBookingCancelled).mockRejectedValueOnce(new Error("smtp"));
    vi.mocked(sendBookingAlert).mockRejectedValueOnce(new Error("smtp"));
    const res = await post({ t: "good", action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "CANCELLED" });
  });

  it("an already-cancelled booking sends no emails", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(booking({ status: "CANCELLED" }) as never);
    await post({ t: "good", action: "cancel" });
    expect(sendBookingCancelled).not.toHaveBeenCalled();
    expect(sendBookingAlert).not.toHaveBeenCalled();
  });

  it("a cancel that loses a race (already cancelled when written) does nothing more", async () => {
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await post({ t: "good", action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "CANCELLED" });
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(prisma.activity.create).not.toHaveBeenCalled();
    expect(sendBookingCancelled).not.toHaveBeenCalled();
    expect(sendBookingAlert).not.toHaveBeenCalled();
  });

  it("cancelling twice makes no second deleteEvent call", async () => {
    await post({ t: "good", action: "cancel" });
    expect(deleteEvent).toHaveBeenCalledTimes(1);
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(booking({ status: "CANCELLED" }) as never);
    vi.mocked(prisma.booking.updateMany).mockClear();
    const res = await post({ t: "good", action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "CANCELLED" });
    expect(deleteEvent).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("Google delete failure does not fail the cancel", async () => {
    vi.mocked(deleteEvent).mockRejectedValueOnce(new Error("boom"));
    const res = await post({ t: "good", action: "cancel" });
    expect(res.status).toBe(200);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("skips Google when there is no event id", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(booking({ googleEventId: null }) as never);
    const res = await post({ t: "good", action: "cancel" });
    expect(res.status).toBe(200);
    expect(deleteEvent).not.toHaveBeenCalled();
  });
});

describe("POST reschedule", () => {
  it("cancelled booking -> 409 cancelled", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(booking({ status: "CANCELLED" }) as never);
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "cancelled" });
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("taken slot -> 409 taken, booking unchanged", async () => {
    vi.mocked(getBusy).mockResolvedValue([
      { start: new Date("2026-11-17T19:00:00Z"), end: new Date("2026-11-17T19:15:00Z") },
    ]);
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "taken" });
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(moveEvent).not.toHaveBeenCalled();
    expect(sendBookingRescheduled).not.toHaveBeenCalled();
    expect(sendBookingAlert).not.toHaveBeenCalled();
  });

  it("success emails the visitor an updated invite and alerts Ryan with old and new times", async () => {
    await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(sendBookingRescheduled).toHaveBeenCalledTimes(1);
    expect(sendBookingRescheduled).toHaveBeenCalledWith(visitor(new Date(NEW_SLOT)), {
      bookingId: "b1",
      changedAt: NOW,
      googleEventId: "g1",
    });
    expect(sendBookingAlert).toHaveBeenCalledTimes(1);
    expect(sendBookingAlert).toHaveBeenCalledWith({
      ...alertBase,
      kind: "moved",
      newStartsAt: new Date(NEW_SLOT),
    });
  });

  it("an email failure does not fail the reschedule", async () => {
    vi.mocked(sendBookingRescheduled).mockRejectedValueOnce(new Error("smtp"));
    vi.mocked(sendBookingAlert).mockRejectedValueOnce(new Error("smtp"));
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ startsAt: NEW_SLOT });
  });

  it("past time -> 409 taken", async () => {
    const res = await post({ t: "good", action: "reschedule", startsAt: "2026-11-16T10:00:00.000Z" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "taken" });
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("success: updates times, clears reminders, moves event, exact activity", async () => {
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ startsAt: NEW_SLOT });
    expect(getBusy).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), {
      fresh: true,
      excludeBookingId: "b1",
    });
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: {
        startsAt: new Date(NEW_SLOT),
        endsAt: new Date("2026-11-17T19:15:00.000Z"),
        scheduledAt: NOW,
        reminder24SentAt: null,
        reminder1SentAt: null,
      },
    });
    expect(moveEvent).toHaveBeenCalledWith("g1", new Date(NEW_SLOT), new Date("2026-11-17T19:15:00.000Z"));
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { type: "NOTE", content: "Rescheduled to Tue, Nov 17 · 11:00 AM PT", leadId: "l1" },
    });
    expect(clearBusyCache).toHaveBeenCalled();
  });

  // Picking the time it's already at: no change, no "moved" email, no alert.
  it("rescheduling to the current time is a no-op", async () => {
    vi.mocked(getBusy).mockResolvedValue([OLD]);
    const res = await post({ t: "good", action: "reschedule", startsAt: OLD.start.toISOString() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ startsAt: OLD.start.toISOString() });
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(moveEvent).not.toHaveBeenCalled();
    expect(sendBookingRescheduled).not.toHaveBeenCalled();
    expect(sendBookingAlert).not.toHaveBeenCalled();
  });

  it("unique-index P2002 -> 409 taken", async () => {
    vi.mocked(prisma.booking.update).mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "taken" });
    expect(moveEvent).not.toHaveBeenCalled();
  });

  it("Google move failure does not undo the change", async () => {
    vi.mocked(moveEvent).mockRejectedValueOnce(new Error("boom"));
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(200);
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(prisma.activity.create).toHaveBeenCalled();
  });

  it("busy unavailable -> 503", async () => {
    vi.mocked(getBusy).mockRejectedValue(new BookingUnavailableError());
    const res = await post({ t: "good", action: "reschedule", startsAt: NEW_SLOT });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("invalid startsAt -> 400", async () => {
    const res = await post({ t: "good", action: "reschedule", startsAt: "nope" });
    expect(res.status).toBe(400);
  });
});
