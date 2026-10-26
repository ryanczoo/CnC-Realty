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
  propertyType: "Single Family", yearBuilt: "1990",
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

  it("refuses a photo key that isn't the caller's", async () => {
    const res = await POST(postJson({ ...VALID_LISTING, photoKey: "wizard-photos/u2/abc/photo.jpg" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid photo");
    expect(prisma.listingFile.create).not.toHaveBeenCalled();
  });

  it("saves the caller's own photo key", async () => {
    await POST(postJson({ ...VALID_LISTING, photoKey: "wizard-photos/u1/abc/photo.jpg" }));
    expect(vi.mocked(prisma.listingFile.create).mock.calls[0][0].data).toMatchObject({ photoKey: "wizard-photos/u1/abc/photo.jpg" });
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

describe("listing commission % can't exceed 100", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "lf1" } as any);
  });

  it("rejects a create with a commission % over 100", async () => {
    const res = await POST(postJson({ ...VALID_LISTING, commissionPercent: "15000" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Commission can't be more than 100%");
    expect(prisma.listingFile.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/listings — Property Type and Year Built", () => {
  const template = { items: [
    { name: "RLA", description: null, order: 1, isRequired: true, builtBefore: null },
    { name: "LPD", description: "lead", order: 2, isRequired: true, builtBefore: 1978 },
  ] };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(template as any);
    vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "lf1" } as any);
  });

  it("requires a property type", async () => {
    const res = await POST(postJson({ ...VALID_LISTING, propertyType: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Missing required fields");
  });

  it("requires a valid year unless the property is Land", async () => {
    expect((await POST(postJson({ ...VALID_LISTING, yearBuilt: "1400" }))).status).toBe(400);
    expect((await POST(postJson({ ...VALID_LISTING, yearBuilt: "" }))).status).toBe(400);
    expect((await POST(postJson({ ...VALID_LISTING, yearBuilt: "", propertyType: "Land" }))).status).toBe(201);
  });

  it("saves both and applies the year-based items", async () => {
    await POST(postJson({ ...VALID_LISTING, yearBuilt: "1952" }));
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data).toMatchObject({ yearBuilt: 1952, propertyType: "Single Family" });
    expect(data.checklistItems.create.map((i: any) => [i.name, i.builtBefore])).toEqual([["RLA", null], ["LPD", 1978]]);
    await POST(postJson({ ...VALID_LISTING, yearBuilt: "2005" }));
    const newer = vi.mocked(prisma.listingFile.create).mock.calls[1][0].data as any;
    expect(newer.checklistItems.create.map((i: any) => i.name)).toEqual(["RLA"]);
  });
});
