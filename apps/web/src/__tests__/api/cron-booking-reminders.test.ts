import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    activity: { create: vi.fn() },
  },
}));
vi.mock("@/lib/google-calendar/api", () => ({
  eventExists: vi.fn(),
  withGoogle: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/booking/tokens", () => ({ manageUrl: (id: string) => `https://x/manage/${id}` }));
vi.mock("@/lib/booking/busy", () => ({ clearBusyCache: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: { set: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { GET } from "@/app/api/cron/booking-reminders/route";
import { prisma } from "@/lib/prisma";
import { eventExists } from "@/lib/google-calendar/api";
import { sendEmail } from "@/lib/email/send";
import { clearBusyCache } from "@/lib/booking/busy";
import { redis } from "@/lib/redis";
import { NOTIFY } from "@/lib/email";

const secret = "test-secret";
const req = (s?: string) =>
  new NextRequest("http://localhost/api/cron/booking-reminders", {
    headers: s ? { authorization: `Bearer ${s}` } : {},
  });

const H = 3_600_000;
const row = (over: object = {}) => ({
  id: "b1",
  leadId: "l1",
  startsAt: new Date(Date.now() + 23 * H),
  scheduledAt: new Date(Date.now() - 72 * H),
  reminder24SentAt: null,
  reminder1SentAt: null,
  googleEventId: "ev1",
  meetLink: null,
  meetingType: "PHONE",
  lead: { firstName: "Ann", lastName: "Lee", email: "a@b.com", phone: "714" },
  ...over,
});
const farOut = (i: number) =>
  row({ id: `b${i}`, leadId: `l${i}`, googleEventId: `ev${i}`, startsAt: new Date(Date.now() + (3 + i) * 24 * H) });
type Sent = { to: string; subject: string; html: string; attachments?: { content: string }[] };
const sentTo = (to: string) => vi.mocked(sendEmail).mock.calls.map((c) => c[0] as Sent).filter((m) => m.to === to);

describe("/api/cron/booking-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", secret);
    vi.mocked(prisma.booking.update).mockResolvedValue({} as never);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.activity.create).mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);
    vi.mocked(clearBusyCache).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 with a bad secret", async () => {
    expect((await GET(req("bad"))).status).toBe(401);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  // Ryan (2026-11-18): deleting a booked call in his calendar emails the visitor, checked every
  // run for every upcoming call, not only when a reminder is due.
  it("looks at every upcoming active booking, not just the next 24 hours", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([] as never);
    await GET(req(secret));
    const where = vi.mocked(prisma.booking.findMany).mock.calls[0][0]!.where as {
      status: string;
      startsAt: { gt?: Date; lte?: Date };
    };
    expect(where.status).toBe("ACTIVE");
    expect(where.startsAt.gt).toBeInstanceOf(Date);
    expect(where.startsAt.lte).toBeUndefined();
  });

  it("deleted event 5 days out: cancels, notes the lead, reopens the time, emails the visitor", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row({ startsAt: new Date(Date.now() + 5 * 24 * H) })] as never);
    vi.mocked(eventExists).mockResolvedValue(false);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 1, held: 0 });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
    expect(prisma.activity.create).toHaveBeenCalled();
    expect(clearBusyCache).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const m = vi.mocked(sendEmail).mock.calls[0][0] as Sent;
    expect(m.to).toBe("a@b.com");
    expect(m.subject).toBe("Meeting with Ryan cancelled!");
    expect(m.html).toContain("Ryan needed to cancel your call.");
    expect(m.attachments).toHaveLength(1);
    const ics = Buffer.from(m.attachments![0].content, "base64").toString("utf8");
    expect(ics.replace(/\r\n /g, "")).toContain("UID:ev1@google.com");
  });

  // The visitor cancelled from their link while this run was going: only the first cancel counts.
  it("a booking already cancelled by the time it's written gets no note, email or count", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockResolvedValue(false);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 0, held: 0 });
    expect(prisma.activity.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a failed cancel email still counts the booking as cancelled", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockResolvedValue(false);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp"));
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 1, held: 0 });
  });

  it("event still there and no reminder due: nothing sent or changed", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row({ startsAt: new Date(Date.now() + 5 * 24 * H) })] as never);
    vi.mocked(eventExists).mockResolvedValue(true);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 0, held: 0 });
    expect(eventExists).toHaveBeenCalledWith("ev1");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  // Google failed to create the event at booking time; the visitor still expects reminders.
  it("a booking with no Google event isn't checked but still gets its due reminder", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row({ googleEventId: null })] as never);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 1, cancelled: 0, held: 0 });
    expect(eventExists).not.toHaveBeenCalled();
    expect(sentTo("a@b.com")).toHaveLength(1);
  });

  it("sends one email and stamps the 24h reminder", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockResolvedValue(true);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 1, cancelled: 0, held: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.booking.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.reminder24SentAt).toBeInstanceOf(Date);
  });

  it("skips (no cancel, no send) when Google is down", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockRejectedValue(new Error("down"));
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 0, held: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  describe("safety brake on automatic cancels", () => {
    // Every upcoming call "missing" at once looks like a Google problem, not Ryan deleting them.
    it("3+ missing and that's every checked call: cancels none, emails no client, alerts Ryan once", async () => {
      vi.mocked(prisma.booking.findMany).mockResolvedValue([farOut(1), farOut(2), farOut(3)] as never);
      vi.mocked(eventExists).mockResolvedValue(false);
      const res = await GET(req(secret));
      expect(await res.json()).toEqual({ sent: 0, cancelled: 0, held: 3 });
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
      expect(prisma.activity.create).not.toHaveBeenCalled();
      expect(sentTo("a@b.com")).toHaveLength(0);
      const alerts = sentTo(NOTIFY);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].subject).toBe("Check needed: 3 booked calls are missing from your Google Calendar");
      expect(alerts[0].html).toContain("Ann Lee");
      expect(alerts[0].html).toContain("a@b.com");
      // At most one alert a day.
      expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), { nx: true, ex: 86_400 });
    });

    it("already alerted today: holds again without another alert", async () => {
      vi.mocked(prisma.booking.findMany).mockResolvedValue([farOut(1), farOut(2), farOut(3)] as never);
      vi.mocked(eventExists).mockResolvedValue(false);
      vi.mocked(redis.set).mockResolvedValue(null as never);
      const res = await GET(req(secret));
      expect(await res.json()).toEqual({ sent: 0, cancelled: 0, held: 3 });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("2 missing (under the brake) are cancelled normally", async () => {
      vi.mocked(prisma.booking.findMany).mockResolvedValue([farOut(1), farOut(2)] as never);
      vi.mocked(eventExists).mockResolvedValue(false);
      const res = await GET(req(secret));
      expect(await res.json()).toEqual({ sent: 0, cancelled: 2, held: 0 });
      expect(sentTo(NOTIFY)).toHaveLength(0);
    });

    it("3 missing out of 4 checked (not all) are cancelled normally", async () => {
      vi.mocked(prisma.booking.findMany).mockResolvedValue([farOut(1), farOut(2), farOut(3), farOut(4)] as never);
      vi.mocked(eventExists).mockImplementation(async (id: string) => id === "ev4");
      const res = await GET(req(secret));
      expect(await res.json()).toEqual({ sent: 0, cancelled: 3, held: 0 });
      expect(sentTo(NOTIFY)).toHaveLength(0);
    });
  });
});
