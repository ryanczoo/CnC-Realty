import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { findMany: vi.fn() }, lead: { create: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));
vi.mock("@/lib/email", () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/home-value/reveal/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/home-value/reveal", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "555-123-4567",
  address: "123 Main St",
  zip: "91101",
  beds: 3,
  sqft: 1500,
};

describe("POST /api/home-value/reveal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ firstName: "Jane" }));
    expect(res.status).toBe(400);
  });

  it("creates a Lead with source HOME_VALUATION and the address in notes", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date(), photos: [] },
    ] as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "HOME_VALUATION",
          email: "jane@example.com",
          notes: expect.stringContaining("123 Main St"),
        }),
      })
    );
  });

  it("returns a pointEstimate on success", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date(), photos: [] },
      { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date(), photos: [] },
    ] as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(typeof body.pointEstimate).toBe("number");
    expect(body.pointEstimate).toBeGreaterThan(0);
  });

  it("calls findComps with excludeMlsNumber equal to the matched subject's mlsNumber", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        {
          mlsNumber: "SUBJECT-1",
          status: "Closed",
          beds: 3,
          baths: 2,
          sqft: 1500,
          lotSize: 0.2,
          listPrice: 800000,
          closePrice: 790000,
          closeDate: new Date(),
          listedAt: new Date(),
          propertyType: "SingleFamilyResidence",
        },
      ] as any) // findSubjectProperty
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date(), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date(), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date(), photos: [] },
      ] as any); // findComps -> queryComps
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    const compsCall = vi.mocked(prisma.property.findMany).mock.calls[1][0] as any;
    expect(compsCall.where.mlsNumber).toEqual({ not: "SUBJECT-1" });
  });

  it("returns 429 when rate limited", async () => {
    const { publicFormRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 60000 } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });
});
