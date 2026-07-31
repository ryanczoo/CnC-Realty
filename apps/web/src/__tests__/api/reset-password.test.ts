import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/reset-password/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/reset-password", () => {
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
      resetTokenExpiry: new Date(Date.now() - 1000),
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

  it("sets the new password and clears the reset token on a valid, unexpired token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      resetTokenExpiry: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await POST(makeRequest({ token: "valid-token", password: "longenoughpassword" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(call.where).toEqual({ id: "user-1" });
    expect(call.data.resetToken).toBeNull();
    expect(call.data.resetTokenExpiry).toBeNull();
    expect(typeof call.data.password).toBe("string");
    expect(call.data.password).not.toBe("longenoughpassword");
  });
});
