import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { create: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));
vi.mock("@/lib/email", () => ({ sendLeadNotification: vi.fn().mockResolvedValue(undefined) }));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/leads/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/leads — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await POST(makeRequest({ firstName: "", lastName: "Doe", email: "jane@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("First name required");
  });
});

describe("POST /api/leads — utmSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
  });

  it("accepts an optional utmSource and stores it on the lead", async () => {
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead1" } as any);

    const res = await POST(new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        role: "Owner",
        notes: "Hi",
        source: "WEBSITE",
        utmSource: "MANAGE_TENANT_PLACEMENT",
      }),
    }));

    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ utmSource: "MANAGE_TENANT_PLACEMENT" }),
    });
  });
});

describe("POST /api/leads — visitor role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
  });

  it("persists the visitor-selected role", async () => {
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead1" } as any);

    const res = await POST(new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        role: "Owner",
        notes: "Hi",
        source: "WEBSITE",
      }),
    }));

    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visitorRole: "Owner" }),
    });
  });
});
