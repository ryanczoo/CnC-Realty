import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));

import { prisma } from "@/lib/prisma";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { POST } from "../../app/api/setup-account/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/setup-account", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/setup-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when the token doesn't match any user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

    const res = await POST(makeRequest({ token: "bogus", password: "longenoughpassword" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/expired or is invalid/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects when the token matches but has expired", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      setupTokenExpiry: new Date(Date.now() - 1000),
    } as any);

    const res = await POST(makeRequest({ token: "expired-token", password: "longenoughpassword" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/expired or is invalid/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await POST(makeRequest({ token: "some-token", password: "short" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Password must be at least 8 characters");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("sets the new password and clears the setup token on a valid, unexpired token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      setupTokenExpiry: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await POST(makeRequest({ token: "valid-token", password: "longenoughpassword" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(call.where).toEqual({ id: "user-1" });
    expect(call.data.setupToken).toBeNull();
    expect(call.data.setupTokenExpiry).toBeNull();
    expect(typeof call.data.password).toBe("string");
    expect(call.data.password).not.toBe("longenoughpassword");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 30000 } as any);

    const res = await POST(makeRequest({ token: "abc", password: "password123" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
