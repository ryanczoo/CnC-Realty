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

  it("matches city only (no address/OR) when a letter-led query is a street name that collides with a city name elsewhere in the state", async () => {
    // Regression test for the "Anaheim"/"Cerritos" bug: a letter-led query
    // used to OR-match against `address` too, so a query for the city of
    // Anaheim also matched unrelated listings on streets named "Anaheim"
    // in other cities. Letter-led queries are now city-only.
    await GET(makeRequest("query=Main+St"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).city).toEqual(
      expect.objectContaining({ contains: "Main St" })
    );
    expect((call.where as any).address).toBeUndefined();
    expect((call.where as any).OR).toBeUndefined();
  });

  it("matches city only when query is a city name", async () => {
    await GET(makeRequest("query=Los+Angeles"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).city).toEqual(
      expect.objectContaining({ contains: "Los Angeles" })
    );
    expect((call.where as any).address).toBeUndefined();
    expect((call.where as any).OR).toBeUndefined();
  });

  it("matches address only (not city) when query starts with a house number", async () => {
    await GET(makeRequest("query=12802+Cantrece+Street"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).address).toEqual(
      expect.objectContaining({ contains: "12802 Cantrece Street" })
    );
    expect((call.where as any).city).toBeUndefined();
    expect((call.where as any).OR).toBeUndefined();
  });

  it("applies no location filter when query is empty", async () => {
    await GET(makeRequest());

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).zip).toBeUndefined();
    expect((call.where as any).city).toBeUndefined();
    expect((call.where as any).OR).toBeUndefined();
  });
});

describe("GET /api/properties — commercial type filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.property.findMany).mockResolvedValue([mockProperty as any]);
    vi.mocked(prisma.property.count).mockResolvedValue(1);
  });

  it("matches every commercial PropertySubType in one bucket when propertyType=Commercial", async () => {
    await GET(makeRequest("propertyType=Commercial"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    const inList = (call.where as any).propertyType.in;
    expect(inList).toEqual(
      expect.arrayContaining([
        "CommercialSale", "CommercialLease", "Office", "Retail", "Industrial",
        "Warehouse", "BusinessOpportunity", "Business", "MixedUse", "SpecialPurpose", "HotelMotel",
      ])
    );
  });

  it("does not use a substring contains match for propertyType=Commercial", async () => {
    // "Commercial" isn't itself a real CRMLS PropertySubType — it's our own
    // aggregate filter value — so it must not fall through to the generic
    // `contains` branch (which would match nothing, since no row's
    // propertyType literally contains the substring "Commercial" across
    // all 11 real commercial subtypes).
    await GET(makeRequest("propertyType=Commercial"));

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0];
    expect((call.where as any).propertyType.contains).toBeUndefined();
  });
});
