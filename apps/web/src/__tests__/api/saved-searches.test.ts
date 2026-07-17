import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { savedSearch: { create: vi.fn(), findMany: vi.fn() } },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/saved-searches/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/saved-searches", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/saved-searches — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "user-1", email: "buyer@example.com", role: "BUYER", agentId: null } },
      error: null,
    } as any);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await POST(makeRequest({ minBeds: 1.5 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid input: expected int, received number");
    expect(prisma.savedSearch.create).not.toHaveBeenCalled();
  });
});
