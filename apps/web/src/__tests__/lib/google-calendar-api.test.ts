process.env.GOOGLE_CAL_CLIENT_ID = "cid";
process.env.GOOGLE_CAL_CLIENT_SECRET = "csecret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue("OK"), del: vi.fn() },
}));
vi.mock("@/lib/google-calendar/connection", () => ({
  getConnection: vi.fn().mockResolvedValue({ status: "connected", email: "a@b.c", refreshToken: "rt" }),
  markBroken: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));

import { redis } from "@/lib/redis";
import { markBroken } from "@/lib/google-calendar/connection";
import { sendEmail } from "@/lib/email/send";
import { freeBusy, createEvent, eventExists, withGoogle } from "@/lib/google-calendar/api";
import { authUrl, exchangeCode } from "@/lib/google-calendar/oauth";
import { GoogleAuthError, MissingScopeError } from "@/lib/google-calendar/errors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenRes = () => json({ access_token: "at", expires_in: 3600 });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.get).mockResolvedValue(null);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("authUrl", () => {
  it("builds the consent URL", () => {
    const u = new URL(authUrl("st"));
    expect(u.searchParams.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy"
    );
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/google-calendar/callback");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("login_hint")).toBe("ryanchong@cncrealtygroup.com");
    expect(u.searchParams.get("state")).toBe("st");
  });
});

describe("google calendar api", () => {
  it("freeBusy maps busy intervals", async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      json({ calendars: { primary: { busy: [{ start: "2026-11-17T18:00:00Z", end: "2026-11-17T18:15:00Z" }] } } })
    );
    const r = await freeBusy(new Date("2026-11-17T00:00:00Z"), new Date("2026-11-18T00:00:00Z"));
    expect(r).toEqual([{ start: new Date("2026-11-17T18:00:00Z"), end: new Date("2026-11-17T18:15:00Z") }]);
    expect(redis.set).toHaveBeenCalledWith("gcal:access-token", "at", { ex: 3540 });
  });

  const ev = {
    bookingId: "b1",
    start: new Date("2026-11-17T18:00:00Z"),
    end: new Date("2026-11-17T18:15:00Z"),
    summary: "s",
    description: "d",
    attendeeEmail: "x@y.z",
  };

  it("createEvent with meet sends conference params and returns hangoutLink", async () => {
    vi.mocked(redis.get).mockResolvedValue("at");
    fetchMock.mockResolvedValueOnce(json({ id: "e1", hangoutLink: "https://meet.google.com/abc" }));
    const r = await createEvent({ ...ev, meet: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("conferenceDataVersion=1");
    expect(url).toContain("sendUpdates=all");
    expect(JSON.parse(init.body).conferenceData.createRequest).toEqual({
      requestId: "b1",
      conferenceSolutionKey: { type: "hangoutsMeet" },
    });
    expect(r).toEqual({ id: "e1", meetLink: "https://meet.google.com/abc" });
  });

  it("createEvent without meet sends no conferenceData", async () => {
    vi.mocked(redis.get).mockResolvedValue("at");
    fetchMock.mockResolvedValueOnce(json({ id: "e2" }));
    const r = await createEvent({ ...ev, meet: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).conferenceData).toBeUndefined();
    expect(r).toEqual({ id: "e2", meetLink: null });
  });

  it("a 401 throws GoogleAuthError", async () => {
    vi.mocked(redis.get).mockResolvedValue("at");
    fetchMock.mockResolvedValueOnce(json({}, 401));
    await expect(freeBusy(new Date(), new Date())).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("invalid_grant on refresh throws GoogleAuthError", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    await expect(freeBusy(new Date(), new Date())).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("eventExists is false for 404 and for cancelled", async () => {
    vi.mocked(redis.get).mockResolvedValue("at");
    fetchMock.mockResolvedValueOnce(json({}, 404));
    expect(await eventExists("e")).toBe(false);
    fetchMock.mockResolvedValueOnce(json({ status: "cancelled" }));
    expect(await eventExists("e")).toBe(false);
    fetchMock.mockResolvedValueOnce(json({ status: "confirmed" }));
    expect(await eventExists("e")).toBe(true);
  });
});

describe("withGoogle", () => {
  it("emails once across two auth failures and rethrows", async () => {
    vi.mocked(markBroken).mockResolvedValueOnce({ firstTime: true }).mockResolvedValueOnce({ firstTime: false });
    const fail = () => Promise.reject(new GoogleAuthError("x"));
    await expect(withGoogle(fail)).rejects.toBeInstanceOf(GoogleAuthError);
    await expect(withGoogle(fail)).rejects.toBeInstanceOf(GoogleAuthError);
    expect(markBroken).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toBe("Booking calendar disconnected — reconnect in Settings");
  });

  it("passes through non-auth errors without markBroken", async () => {
    await expect(withGoogle(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(markBroken).not.toHaveBeenCalled();
  });
});

describe("freeBusy calendar errors", () => {
  it("throws when primary calendar reports errors instead of reporting free time", async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      json({ calendars: { primary: { errors: [{ domain: "global", reason: "notFound" }], busy: [] } } })
    );
    await expect(freeBusy(new Date(), new Date())).rejects.toThrow();
  });
});

describe("freeBusy missing primary", () => {
  it("throws when calendars.primary is absent", async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(json({ calendars: {} }));
    await expect(freeBusy(new Date(), new Date())).rejects.toThrow();
  });
});

describe("exchangeCode email_verified", () => {
  const tok = () =>
    json({
      access_token: "at",
      refresh_token: "rt",
      scope: "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy",
    });
  it("returns email when verified", async () => {
    fetchMock.mockResolvedValueOnce(tok()).mockResolvedValueOnce(json({ email: "a@b.c", email_verified: true }));
    await expect(exchangeCode("c")).resolves.toEqual({ refreshToken: "rt", email: "a@b.c" });
  });
  it("throws when email_verified is false", async () => {
    fetchMock.mockResolvedValueOnce(tok()).mockResolvedValueOnce(json({ email: "a@b.c", email_verified: false }));
    await expect(exchangeCode("c")).rejects.toThrow();
  });
  it("throws when email_verified is missing", async () => {
    fetchMock.mockResolvedValueOnce(tok()).mockResolvedValueOnce(json({ email: "a@b.c" }));
    await expect(exchangeCode("c")).rejects.toThrow();
  });
});

const errBody = (reason: string) => json({ error: { code: 403, errors: [{ reason }] } }, 403);

describe("403 classification", () => {
  it("insufficientPermissions is a GoogleAuthError", async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(errBody("insufficientPermissions"));
    await expect(freeBusy(new Date(), new Date())).rejects.toBeInstanceOf(GoogleAuthError);
  });
  it("rateLimitExceeded stays a plain Error", async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(errBody("rateLimitExceeded"));
    const p = freeBusy(new Date(), new Date());
    await expect(p).rejects.not.toBeInstanceOf(GoogleAuthError);
    await expect(p).rejects.toThrow(/403/);
  });
});

describe("exchangeCode scopes", () => {
  it("throws MissingScopeError when calendar.events was not granted", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ access_token: "at", refresh_token: "rt", scope: "openid email https://www.googleapis.com/auth/calendar.freebusy" })
    );
    await expect(exchangeCode("c")).rejects.toBeInstanceOf(MissingScopeError);
  });
  it("accepts a token with both calendar scopes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          access_token: "at",
          refresh_token: "rt",
          scope: "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy",
        })
      )
      .mockResolvedValueOnce(json({ email: "a@b.c", email_verified: true }));
    await expect(exchangeCode("c")).resolves.toEqual({ refreshToken: "rt", email: "a@b.c" });
  });
});
