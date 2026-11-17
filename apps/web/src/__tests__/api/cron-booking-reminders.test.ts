import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    activity: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/google-calendar/api", () => ({
  eventExists: vi.fn(),
  withGoogle: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/booking/tokens", () => ({ manageUrl: (id: string) => `https://x/manage/${id}` }));

import { GET } from "@/app/api/cron/booking-reminders/route";
import { prisma } from "@/lib/prisma";
import { eventExists } from "@/lib/google-calendar/api";
import { sendEmail } from "@/lib/email/send";

const secret = "test-secret";
const req = (s?: string) =>
  new NextRequest("http://localhost/api/cron/booking-reminders", {
    headers: s ? { authorization: `Bearer ${s}` } : {},
  });

const H = 3_600_000;
const row = () => ({
  id: "b1",
  leadId: "l1",
  startsAt: new Date(Date.now() + 23 * H),
  scheduledAt: new Date(Date.now() - 72 * H),
  reminder24SentAt: null,
  reminder1SentAt: null,
  googleEventId: "ev1",
  meetLink: null,
  meetingType: "PHONE",
  lead: { firstName: "Ann", email: "a@b.com", phone: "714" },
});

describe("/api/cron/booking-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", secret);
  });

  it("401 with a bad secret", async () => {
    expect((await GET(req("bad"))).status).toBe(401);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("cancels a booking whose Google event was deleted, no email", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockResolvedValue(false);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.booking.update).mock.calls[0][0].data).toMatchObject({ status: "CANCELLED" });
    expect(prisma.activity.create).toHaveBeenCalled();
  });

  it("sends one email and stamps the 24h reminder", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockResolvedValue(true);
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 1, cancelled: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.booking.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.reminder24SentAt).toBeInstanceOf(Date);
  });

  it("skips (no cancel, no send) when Google is down", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([row()] as never);
    vi.mocked(eventExists).mockRejectedValue(new Error("down"));
    const res = await GET(req(secret));
    expect(await res.json()).toEqual({ sent: 0, cancelled: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});
