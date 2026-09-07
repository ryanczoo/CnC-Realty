import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));

import { prisma } from "@/lib/prisma";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { POST } from "../../app/api/auth/register/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/register — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: true, reset: Date.now() + 60000 } as any);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "longenoughpassword" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Valid email required");
  });
});

describe("POST /api/auth/register — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 5000 } as any);
    const res = await POST(makeRequest({ email: "a@example.com", password: "password123" }));
    expect(res.status).toBe(429);
  });

  it("registers successfully when not rate limited", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: true, reset: Date.now() + 60000 } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u1" } as any);
    const res = await POST(makeRequest({ email: "a@example.com", password: "password123" }));
    expect(res.status).toBe(201);
  });
});
