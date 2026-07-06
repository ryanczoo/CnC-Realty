import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/properties/route";

const mockProperty = {
  id: "1",
  mlsNumber: "ML1",
  status: "ActiveUnderContract",
  listPrice: 500000,
  beds: 3,
  baths: 2,
  sqft: 1500,
  propertyType: "Residential",
  address: "123 Main St",
  city: "Pasadena",
  state: "CA",
  zip: "91101",
  latitude: 34.15,
  longitude: -118.13,
  photos: [],
  listedAt: null,
};

function makeRequest(qs = "") {
  return new Request(`http://localhost/api/properties${qs ? `?${qs}` : ""}`);
}

describe("GET /api/properties — status filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);
    vi.mocked(prisma.property.count).mockResolvedValue(0);
  });

  it("includes ActiveUnderContract in the status filter", async () => {
    await GET(makeRequest());

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).status.in).toContain("ActiveUnderContract");
  });

  it("includes ComingSoon (no space — matches RESO data) in the status filter", async () => {
    await GET(makeRequest());

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).status.in).toContain("ComingSoon");
  });

  it("still includes Active", async () => {
    await GET(makeRequest());

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).status.in).toContain("Active");
  });
});

describe("GET /api/properties — query search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.property.findMany).mockResolvedValue([mockProperty as any]);
    vi.mocked(prisma.property.count).mockResolvedValue(1);
  });

  it("matches zip exactly when query is 5 digits", async () => {
    await GET(makeRequest("query=91101"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).zip).toBe("91101");
    expect((call.where as any).OR).toBeUndefined();
  });

  it("searches city AND address with OR when query is a text string", async () => {
    await GET(makeRequest("query=Main+St"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    const orClause = (call.where as any).OR;
    expect(orClause).toBeDefined();
    expect(orClause).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ city: expect.objectContaining({ contains: "Main St" }) }),
        expect.objectContaining({ address: expect.objectContaining({ contains: "Main St" }) }),
      ])
    );
  });

  it("searches city AND address with OR when query is a city name", async () => {
    await GET(makeRequest("query=Los+Angeles"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    const orClause = (call.where as any).OR;
    expect(orClause).toBeDefined();
    expect(orClause).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ city: expect.objectContaining({ contains: "Los Angeles" }) }),
        expect.objectContaining({ address: expect.objectContaining({ contains: "Los Angeles" }) }),
      ])
    );
  });

  it("applies no location filter when query is empty", async () => {
    await GET(makeRequest());

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).zip).toBeUndefined();
    expect((call.where as any).city).toBeUndefined();
    expect((call.where as any).OR).toBeUndefined();
  });
});
