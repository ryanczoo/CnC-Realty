vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    savedProperty: { findMany: vi.fn() },
    propertyView: { findMany: vi.fn() },
    property: { findMany: vi.fn() },
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/leads/[id]/homes/route";

describe("GET /api/leads/[id]/homes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.savedProperty.findMany).mockResolvedValue([]);
    vi.mocked(prisma.propertyView.findMany).mockResolvedValue([]);
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);
  });

  it("looks up the lead in a single query, not two", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "AGENT", agentId: "a1" } }, error: null } as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1", email: null } as any);

    await GET(new Request("http://localhost"), { params: { id: "lead1" } });

    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the lead does not exist", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the lead belongs to a different agent", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a2", email: "x@example.com" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "lead1" } });
    expect(res.status).toBe(404);
  });

  it("returns empty saved/viewed when the lead has no email", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1", email: null } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "lead1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ saved: [], viewed: [] });
  });

  it("returns saved/viewed properties for a matching buyer account", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1", email: "buyer@example.com" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u2" } as any);
    vi.mocked(prisma.savedProperty.findMany).mockResolvedValue([
      { mlsNumber: "M1", createdAt: new Date("2026-01-01") },
    ] as any);
    vi.mocked(prisma.propertyView.findMany).mockResolvedValue([
      { mlsNumber: "M2", viewedAt: new Date("2026-01-02") },
    ] as any);
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { mlsNumber: "M1", address: "1 Main St", city: "LA", listPrice: 500000, beds: 3, baths: 2, sqft: 1500, photos: [] },
      { mlsNumber: "M2", address: "2 Oak St", city: "LA", listPrice: 600000, beds: 4, baths: 3, sqft: 2000, photos: [] },
    ] as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "lead1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toHaveLength(1);
    expect(data.saved[0].property.address).toBe("1 Main St");
    expect(data.viewed).toHaveLength(1);
    expect(data.viewed[0].property.address).toBe("2 Oak St");
  });
});
