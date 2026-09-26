import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    listingFile: { findMany: vi.fn(), create: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/listings/route";

describe("GET /api/listings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 404 when session has no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: null } } as any);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("scopes listings using session.agentId, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.listingFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "a1" } })
    );
  });
});

const postJson = (body: unknown) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const VALID_LISTING = {
  propertyAddress: "1 Main St", city: "Irvine", zip: "92603", listPrice: "500000", listingType: "RESIDENTIAL_SALE",
  listDate: "2026-09-24", expirationDate: "2027-03-24",
  parties: [{ role: "SELLER", name: "Jane Seller", email: "jane@example.com", phone: "", company: "", licenseNumber: "" }],
};

describe("POST /api/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "lf1" } as any);
  });

  it.each(["listDate", "expirationDate"] as const)("returns 400 when %s is missing", async (field) => {
    const res = await POST(postJson({ ...VALID_LISTING, [field]: "" }));
    expect(res.status).toBe(400);
    expect(prisma.listingFile.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the expiration date is before the list date", async () => {
    const res = await POST(postJson({ ...VALID_LISTING, listDate: "2026-09-24", expirationDate: "2026-09-01" }));
    expect(res.status).toBe(400);
    expect(prisma.listingFile.create).not.toHaveBeenCalled();
  });

  it("returns 400 when no parties are sent", async () => {
    const { parties: _omit, ...noParties } = VALID_LISTING;
    const res = await POST(postJson(noParties));
    expect(res.status).toBe(400);
    expect(prisma.listingFile.create).not.toHaveBeenCalled();
  });

  it("returns 400 when no SELLER party has a name", async () => {
    const res = await POST(postJson({ ...VALID_LISTING, parties: [{ role: "SELLER", name: "  " }] }));
    expect(res.status).toBe(400);
    expect(prisma.listingFile.create).not.toHaveBeenCalled();
  });

  it("stores blank optional MLS number and commission notes as null, not empty strings", async () => {
    const res = await POST(postJson({ ...VALID_LISTING, mlsNumber: "", commissionNotes: "" }));
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data.mlsNumber).toBeNull();
    expect(data.commissionNotes).toBeNull();
  });

  it("creates the named seller parties on the listing file", async () => {
    const res = await POST(postJson({
      ...VALID_LISTING,
      parties: [
        { role: "SELLER", name: "Jane Seller", email: "jane@example.com", phone: "(555) 555-5555" },
        { role: "SELLER", name: "" },
      ],
    }));
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data.parties.create).toEqual([
      { fileType: "LISTING", role: "SELLER", name: "Jane Seller", email: "jane@example.com", phone: "(555) 555-5555", company: null, licenseNumber: null },
    ]);
  });
});

describe("POST /api/listings — commission as % or $", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "lf1" } as any);
  });

  it("saves a flat commission amount", async () => {
    await POST(postJson({ ...VALID_LISTING, commissionAmount: "15000" }));
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data.commissionAmount).toBe(15000);
    expect(data.commissionPercent).toBeNull();
  });

  it("stores a blank amount as null", async () => {
    await POST(postJson({ ...VALID_LISTING, commissionPercent: "2.5", commissionAmount: "" }));
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data.commissionAmount).toBeNull();
    expect(data.commissionPercent).toBe(2.5);
  });
});
