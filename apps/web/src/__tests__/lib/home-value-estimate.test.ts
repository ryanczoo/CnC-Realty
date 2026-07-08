import { describe, it, expect, vi } from "vitest";
import { computeEstimate, percentile } from "@/lib/home-value-estimate";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
  },
}));

describe("percentile", () => {
  it("returns the single value for a one-element array", () => {
    expect(percentile([500], 0.5)).toBe(500);
  });

  it("returns the median for an odd-length sorted array", () => {
    expect(percentile([100, 200, 300], 0.5)).toBe(200);
  });

  it("interpolates for an even-length sorted array", () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
  });
});

describe("computeEstimate", () => {
  it("returns null for an empty comps array", () => {
    expect(computeEstimate([], 2000)).toBeNull();
  });

  it("returns null when subjectSqft is null, zero, or negative", () => {
    const comps = [{ closePrice: 500000, sqft: 1000 }];
    expect(computeEstimate(comps, null)).toBeNull();
    expect(computeEstimate(comps, 0)).toBeNull();
    expect(computeEstimate(comps, -100)).toBeNull();
  });

  it("computes a point estimate from the median $/sqft of comps", () => {
    // $/sqft: 500, 600, 700 -> median 600
    const comps = [
      { closePrice: 500000, sqft: 1000 },
      { closePrice: 600000, sqft: 1000 },
      { closePrice: 700000, sqft: 1000 },
    ];
    const result = computeEstimate(comps, 1500);
    expect(result).not.toBeNull();
    expect(result!.pointEstimate).toBe(900000); // 600 * 1500
    expect(result!.compCount).toBe(3);
  });

  it("computes rangeLow/rangeHigh from the 25th/75th percentile $/sqft", () => {
    const comps = [
      { closePrice: 500000, sqft: 1000 }, // 500
      { closePrice: 600000, sqft: 1000 }, // 600
      { closePrice: 700000, sqft: 1000 }, // 700
      { closePrice: 800000, sqft: 1000 }, // 800
    ];
    const result = computeEstimate(comps, 1000);
    expect(result).not.toBeNull();
    // sorted $/sqft: [500,600,700,800] -> p25=575, p75=725
    expect(result!.rangeLow).toBe(575000);
    expect(result!.rangeHigh).toBe(725000);
  });

  it("filters out comps with zero or missing sqft/closePrice before computing", () => {
    const comps = [
      { closePrice: 500000, sqft: 1000 },
      { closePrice: 0, sqft: 1000 },
      { closePrice: 500000, sqft: 0 },
    ];
    const result = computeEstimate(comps, 1000);
    expect(result).not.toBeNull();
    expect(result!.compCount).toBe(1);
  });

  it("returns null when all comps are filtered out as invalid", () => {
    const comps = [{ closePrice: 0, sqft: 1000 }];
    expect(computeEstimate(comps, 1000)).toBeNull();
  });
});

describe("findSubjectProperty", () => {
  it("queries by zip-exact and address-contains, ordered by listedAt desc", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await findSubjectProperty(prisma as any, "123 Main St", "91101");

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.zip).toBe("91101");
    expect(call.where.address.contains).toBe("123 Main St");
    expect(call.where.address.mode).toBe("insensitive");
    expect(call.orderBy).toEqual({ listedAt: "desc" });
  });

  it("returns the matched records unchanged", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [
      {
        mlsNumber: "ML1",
        status: "Closed",
        beds: 4,
        baths: 2,
        sqft: 1800,
        lotSize: 0.15,
        listPrice: 950000,
        closePrice: 940000,
        closeDate: new Date("2025-01-10"),
        listedAt: new Date("2024-11-01"),
      },
    ];
    vi.mocked(prisma.property.findMany).mockResolvedValue(fixture as any);

    const result = await findSubjectProperty(prisma as any, "123 Main St", "91101");
    expect(result).toEqual(fixture);
  });
});
