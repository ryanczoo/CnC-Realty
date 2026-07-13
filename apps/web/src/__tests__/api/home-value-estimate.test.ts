import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/home-value/estimate/route";

function makeRequest(qs: string) {
  return new Request(`http://localhost/api/home-value/estimate?${qs}`);
}

describe("GET /api/home-value/estimate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns needsManualEntry: true and null range when no subject match and no manual beds/sqft given", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    const res = await GET(makeRequest("address=999 Nowhere Ln&zip=90000"));
    const body = await res.json();

    expect(body.needsManualEntry).toBe(true);
    expect(body.subject).toBeNull();
    expect(body.range).toBeNull();
    expect(body.comps).toEqual([]);
  });

  it("uses the subject match's beds/sqft when found in the DB", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        {
          mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15,
          listPrice: 950000, closePrice: 940000, closeDate: new Date("2025-01-10"), listedAt: new Date("2024-11-01"),
        },
      ] as any) // findSubjectProperty
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1750, closePrice: 900000, closeDate: new Date("2026-01-01"), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1600, closePrice: 800000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1900, closePrice: 950000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any) // findComps
      .mockResolvedValueOnce([]); // getMarketSnapshot

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body.needsManualEntry).toBe(false);
    expect(body.subject).toEqual(expect.objectContaining({ beds: 4, baths: 2, sqft: 1800, matched: true }));
    expect(body.range).not.toBeNull();
    expect(body.range.compCount).toBe(3);
    expect(body.comps).toHaveLength(3);
    expect(body.priceHistory).toHaveLength(1);
  });

  it("uses manual beds/sqft query params when no DB match exists", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // findSubjectProperty strict — no match
      .mockResolvedValueOnce([]) // findSubjectProperty suffix-stripped fallback — no match
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 750000, closeDate: new Date("2026-01-01"), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 780000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1500, closePrice: 760000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=999 New Home Rd&zip=91101&beds=3&baths=2&sqft=1500"));
    const body = await res.json();

    expect(body.needsManualEntry).toBe(false);
    expect(body.subject).toEqual(expect.objectContaining({ beds: 3, baths: 2, sqft: 1500, matched: false }));
    expect(body.range).not.toBeNull();
  });

  it("never includes a pointEstimate field in the response", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        { mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15, listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date() },
      ] as any)
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "a", city: "c", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1800, closePrice: 900000, closeDate: new Date(), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body).not.toHaveProperty("pointEstimate");
    expect(JSON.stringify(body)).not.toContain("pointEstimate");
  });

  it("includes the subject property's first MLS photo when available", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        {
          mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15,
          listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date(),
          photos: ["https://subject-photo-a.jpg", "https://subject-photo-b.jpg"],
        },
      ] as any)
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1750, closePrice: 900000, closeDate: new Date("2026-01-01"), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1600, closePrice: 800000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1900, closePrice: 950000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body.subject.photo).toBe("https://subject-photo-a.jpg");
  });

  it("subject.photo is null when the subject property has no photos", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        {
          mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15,
          listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date(),
          photos: [],
        },
      ] as any)
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1750, closePrice: 900000, closeDate: new Date("2026-01-01"), photos: [] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1600, closePrice: 800000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1900, closePrice: 950000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body.subject.photo).toBeNull();
  });

  it("returns 400 when address or zip is missing", async () => {
    const res = await GET(makeRequest("address=123 Main St"));
    expect(res.status).toBe(400);
  });

  it("sends every fetched comp to the client (not capped) so the UI can paginate through all of them", async () => {
    const manyComps = Array.from({ length: 25 }, (_, i) => ({
      mlsNumber: `ML${i}`, address: `${100 + i} Main St`, city: "Pasadena", state: "CA", zip: "91101",
      beds: 4, baths: 2, sqft: 1800, closePrice: 900000 + i * 1000, closeDate: new Date("2026-01-01"),
      photos: [`https://photo-${i}-a.jpg`, `https://photo-${i}-b.jpg`],
    }));

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        { mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15, listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date() },
      ] as any)
      .mockResolvedValueOnce(manyComps as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body.range.compCount).toBe(25);
    expect(body.comps.length).toBe(25);
  });

  it("sends only the first photo per comp, not the full photos array", async () => {
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([
        { mlsNumber: "ML1", status: "Closed", beds: 4, baths: 2, sqft: 1800, lotSize: 0.15, listPrice: 950000, closePrice: 940000, closeDate: new Date(), listedAt: new Date() },
      ] as any)
      .mockResolvedValueOnce([
        { mlsNumber: "ML2", address: "125 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1750, closePrice: 900000, closeDate: new Date("2026-01-01"), photos: ["https://first.jpg", "https://second.jpg"] },
        { mlsNumber: "ML3", address: "130 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 3, baths: 2, sqft: 1600, closePrice: 800000, closeDate: new Date("2026-02-01"), photos: [] },
        { mlsNumber: "ML4", address: "140 Main St", city: "Pasadena", state: "CA", zip: "91101", beds: 4, baths: 2, sqft: 1900, closePrice: 950000, closeDate: new Date("2026-03-01"), photos: [] },
      ] as any)
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest("address=123 Main St&zip=91101"));
    const body = await res.json();

    expect(body.comps[0].photo).toBe("https://first.jpg");
    expect(body.comps[0]).not.toHaveProperty("photos");
  });
});
