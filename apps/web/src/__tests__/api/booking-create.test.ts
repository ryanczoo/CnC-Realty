import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const tx = { lead: { create: vi.fn() }, booking: { create: vi.fn() } };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    booking: { update: vi.fn() },
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
  createEvent: vi.fn(),
  withGoogle: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/google-calendar/errors", () => ({
  GoogleAuthError: class GoogleAuthError extends Error {},
}));
vi.mock("@/lib/tags", () => ({ applyTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/leads/create-lead", async (orig) => ({
  ...(await orig<typeof import("@/lib/leads/create-lead")>()),
  afterLeadCreated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/booking/tokens", () => ({
  manageUrl: vi.fn((id: string) => `https://site.test/booking/manage?t=${id}`),
  verifyRecruitToken: vi.fn((t: string) =>
    t === "VECTOR" ? { firstName: "José", lastName: "O'Neil", email: "jose@example.com" } : null
  ),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getBusy, BookingUnavailableError } from "@/lib/booking/busy";
import { createEvent } from "@/lib/google-calendar/api";
import { GoogleAuthError } from "@/lib/google-calendar/errors";
import { applyTag } from "@/lib/tags";
import { afterLeadCreated } from "@/lib/leads/create-lead";
import { POST } from "@/app/api/booking/route";
import { GET as prefill } from "@/app/api/booking/prefill/route";

const NOW = new Date("2026-11-16T17:00:00Z");
const SLOT = "2026-11-17T18:15:00.000Z"; // Tue Nov 17 10:15 AM PT

function body(over: object = {}) {
  return {
    startsAt: SLOT,
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan@example.com",
    phone: "(714) 555-0100",
    role: "Buyer",
    meetingType: "MEET",
    page: "CONTACT",
    ...over,
  };
}
function req(b: object) {
  return new Request("http://localhost/api/booking", {
    method: "POST",
    body: JSON.stringify(b),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(getBusy).mockResolvedValue([]);
  tx.lead.create.mockResolvedValue({ id: "lead1", email: "jordan@example.com" });
  tx.booking.create.mockResolvedValue({
    id: "b1",
    startsAt: new Date(SLOT),
    endsAt: new Date("2026-11-17T18:30:00.000Z"),
    meetingType: "MEET",
  });
  vi.mocked(createEvent).mockResolvedValue({ id: "evt1", meetLink: "https://meet.google.com/abc" });
  vi.mocked(prisma.booking.update).mockResolvedValue({} as never);
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never);
});
afterEach(() => vi.useRealTimers());

describe("POST /api/booking", () => {
  it("creates lead, booking, event, tag and activity", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.meetLink).toBe("https://meet.google.com/abc");
    expect(json.meetingType).toBe("MEET");
    expect(json.manageUrl).toContain("b1");

    const leadData = tx.lead.create.mock.calls[0][0].data;
    expect(leadData.agentId).toBeUndefined();
    expect(leadData.source).toBe("WEBSITE");
    expect(leadData.utmSource).toBe("BOOKING_CONTACT");
    expect(applyTag).toHaveBeenCalledWith("lead1", "Booked Call");
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: {
        type: "NOTE",
        content: "Booked a 15-min call for Tue, Nov 17 · 10:15 AM PT (Google Meet)",
        leadId: "lead1",
      },
    });
    expect(vi.mocked(createEvent).mock.calls[0][0].meet).toBe(true);
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { googleEventId: "evt1", meetLink: "https://meet.google.com/abc" },
    });
    expect(afterLeadCreated).toHaveBeenCalledWith(expect.anything(), { newsletterConsent: true });
  });

  it("returns 409 taken on a unique violation and does not create an event", async () => {
    tx.booking.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(req(body()));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("taken");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("returns 409 for a slot inside the minimum notice, creating nothing", async () => {
    const res = await POST(req(body({ startsAt: "2026-11-16T17:10:00.000Z" })));
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.lead.create).not.toHaveBeenCalled();
  });

  it("returns 503 when busy time is unavailable", async () => {
    vi.mocked(getBusy).mockRejectedValue(new BookingUnavailableError());
    const res = await POST(req(body()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("unavailable");
  });

  it("returns 400 without a phone", async () => {
    const res = await POST(req(body({ phone: "" })));
    expect(res.status).toBe(400);
    expect(tx.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a role outside ROLE_OPTIONS", async () => {
    expect((await POST(req(body({ role: "Wizard" })))).status).toBe(400);
  });

  it("tags Recruiting Email for a valid recruit token", async () => {
    const res = await POST(req(body({ recruitToken: "VECTOR", page: "JOIN" })));
    expect(res.status).toBe(201);
    expect(vi.mocked(applyTag).mock.calls.map((c) => c[1])).toEqual(["Booked Call", "Recruiting Email"]);
    expect(tx.booking.create.mock.calls[0][0].data.source).toBe("RECRUITING_EMAIL");
    expect(tx.lead.create.mock.calls[0][0].data.utmSource).toBe("BOOKING_RECRUITING_EMAIL");
  });

  it("ignores a forged recruit token", async () => {
    const res = await POST(req(body({ recruitToken: "forged", page: "JOIN" })));
    expect(res.status).toBe(201);
    expect(vi.mocked(applyTag).mock.calls.map((c) => c[1])).toEqual(["Booked Call"]);
    expect(tx.booking.create.mock.calls[0][0].data.source).toBe("JOIN");
  });

  it("keeps the booking when Google fails after the insert", async () => {
    vi.mocked(createEvent).mockRejectedValue(new GoogleAuthError());
    const res = await POST(req(body()));
    expect(res.status).toBe(201);
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect((await res.json()).meetLink).toBeNull();
  });
});

describe("GET /api/booking/prefill", () => {
  it("returns the recruit details for a valid token", async () => {
    const res = await prefill(new Request("http://localhost/api/booking/prefill?t=VECTOR"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ firstName: "José", lastName: "O'Neil", email: "jose@example.com" });
  });

  it("404s for a bad or missing token", async () => {
    expect((await prefill(new Request("http://localhost/api/booking/prefill?t=nope"))).status).toBe(404);
    expect((await prefill(new Request("http://localhost/api/booking/prefill"))).status).toBe(404);
  });
});
