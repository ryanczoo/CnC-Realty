import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

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
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "longenoughpassword" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Valid email required");
  });
});
