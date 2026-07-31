import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/email", () => ({ sendPasswordReset: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendPasswordReset } from "@/lib/email";
import { POST } from "../../app/api/auth/forgot-password/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same generic success response when no account matches the email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

    const res = await POST(makeRequest({ email: "nobody@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it("returns the same generic success response when an account does match", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "jane@example.com" } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined as any);

    const res = await POST(makeRequest({ email: "jane@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("generates a reset token with a ~2 hour expiry and saves it on the matched user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "jane@example.com" } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined as any);

    const before = Date.now();
    await POST(makeRequest({ email: "jane@example.com" }));

    expect(prisma.user.update).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.user.update).mock.calls[0][0] as any;

    expect(call.where).toEqual({ id: "user-1" });
    expect(typeof call.data.resetToken).toBe("string");
    expect(call.data.resetToken.length).toBeGreaterThanOrEqual(32);

    const expiryMs = new Date(call.data.resetTokenExpiry).getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThan(before + twoHoursMs - 5000);
    expect(expiryMs).toBeLessThan(before + twoHoursMs + 5000);
  });

  it("emails a reset link containing the generated token to the matched user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "jane@example.com" } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined as any);

    await POST(makeRequest({ email: "jane@example.com" }));

    expect(sendPasswordReset).toHaveBeenCalledOnce();
    const [to, resetUrl] = vi.mocked(sendPasswordReset).mock.calls[0];
    expect(to).toBe("jane@example.com");

    const savedToken = vi.mocked(prisma.user.update).mock.calls[0][0].data.resetToken;
    expect(resetUrl).toContain(`/reset-password?token=${savedToken}`);
  });
});
