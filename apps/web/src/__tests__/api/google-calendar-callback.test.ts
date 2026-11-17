process.env.GOOGLE_CAL_CLIENT_ID = "cid";
process.env.GOOGLE_CAL_CLIENT_SECRET = "csecret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
vi.mock("@/lib/google-calendar/connection", () => ({
  saveConnection: vi.fn().mockResolvedValue(undefined),
  getConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));
vi.mock("@/lib/google-calendar/oauth", () => ({
  exchangeCode: vi.fn(),
  authUrl: vi.fn((s: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${s}`),
}));

import { requireAuth } from "@/lib/api-auth";
import { saveConnection } from "@/lib/google-calendar/connection";
import { exchangeCode } from "@/lib/google-calendar/oauth";
import { MissingScopeError } from "@/lib/google-calendar/errors";
import { GET as callback } from "../../app/api/google-calendar/callback/route";
import { GET as connect } from "../../app/api/google-calendar/connect/route";

const cb = (qs: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000/api/google-calendar/callback?${qs}`, {
    headers: cookie ? { cookie } : {},
  });

beforeEach(() => vi.clearAllMocks());

describe("callback", () => {
  it("rejects a bad state with 400", async () => {
    const res = await callback(cb("code=c&state=bad", "gcal_state=good"));
    expect(res.status).toBe(400);
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("rejects a missing cookie with 400", async () => {
    const res = await callback(cb("code=c&state=s"));
    expect(res.status).toBe(400);
  });

  it("redirects wrong-account and saves nothing for a personal Gmail", async () => {
    vi.mocked(exchangeCode).mockResolvedValue({ refreshToken: "rt", email: "someone@gmail.com" });
    const res = await callback(cb("code=c&state=s", "gcal_state=s"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard/settings?gcal=wrong-account");
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("redirects missing-scope and saves nothing when calendar access was not granted", async () => {
    vi.mocked(exchangeCode).mockRejectedValue(new MissingScopeError());
    const res = await callback(cb("code=c&state=s", "gcal_state=s"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard/settings?gcal=missing-scope");
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("saves and redirects connected for the booking account (case-insensitive)", async () => {
    vi.mocked(exchangeCode).mockResolvedValue({ refreshToken: "rt", email: "RyanChong@cncrealtygroup.com" });
    const res = await callback(cb("code=c&state=s", "gcal_state=s"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard/settings?gcal=connected");
    expect(saveConnection).toHaveBeenCalledWith("RyanChong@cncrealtygroup.com", "rt");
  });
});

describe("connect", () => {
  it("returns 403 for an agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await connect();
    expect(res.status).toBe(403);
  });

  it("sets the state cookie and redirects for an admin", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: {} as never, error: null });
    const res = await connect();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("accounts.google.com");
    expect(res.headers.get("set-cookie")).toMatch(/gcal_state=[0-9a-f]{64}/);
  });
});
