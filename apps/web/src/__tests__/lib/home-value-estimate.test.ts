import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeEstimate, percentile, firstPhoto, haversineDistanceMeters } from "@/lib/home-value-estimate";

describe("firstPhoto", () => {
  it("returns the first photo URL when photos is a non-empty string array", () => {
    expect(firstPhoto(["https://a.jpg", "https://b.jpg"])).toBe("https://a.jpg");
  });

  it("returns null when photos is an empty array", () => {
    expect(firstPhoto([])).toBeNull();
  });

  it("returns null when photos is not an array", () => {
    expect(firstPhoto(null)).toBeNull();
    expect(firstPhoto(undefined)).toBeNull();
    expect(firstPhoto("not-an-array")).toBeNull();
  });

  it("returns null when the first element isn't a string", () => {
    expect(firstPhoto([123])).toBeNull();
  });
});

describe("haversineDistanceMeters", () => {
  it("computes ~111.2m for two points 0.001 degrees apart at the equator", () => {
    // R=6371000 (mean Earth radius) gives 111.195m per 0.001deg here, not
    // the commonly-quoted 111.32m/0.001deg figure (which uses a slightly
    // different reference radius) — assert what this formula actually
    // produces, not the rule-of-thumb number.
    const distance = haversineDistanceMeters(0, 0, 0, 0.001);
    expect(distance).toBeCloseTo(111.2, 1);
  });

  it("computes roughly 11km for two points 0.1 degrees apart at the equator", () => {
    const distance = haversineDistanceMeters(0, 0, 0, 0.1);
    expect(distance).toBeGreaterThan(11000);
    expect(distance).toBeLessThan(11200);
  });

  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceMeters(37.9586, -120.2830, 37.9586, -120.2830)).toBe(0);
  });
});

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
  beforeEach(() => vi.clearAllMocks());

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

  it("falls back to a suffix-stripped match when the geocoder spells out the street type but MLS data abbreviates it", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [
      {
        mlsNumber: "1170039079",
        status: "Closed",
        beds: 3,
        baths: 2,
        sqft: 1500,
        lotSize: null,
        listPrice: null,
        closePrice: 500000,
        closeDate: new Date("2025-02-01"),
        listedAt: new Date("2024-12-01"),
      },
    ];

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict "15595 Curtis Circle" — DB has "15595 Curtis Cir", no match
      .mockResolvedValueOnce(fixture as any); // fallback "15595 Curtis" — matches

    const result = await findSubjectProperty(prisma as any, "15595 Curtis Circle", "95370");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    const fallbackCall = vi.mocked(prisma.property.findMany).mock.calls[1][0] as any;
    expect(fallbackCall.where.zip).toBe("95370");
    expect(fallbackCall.where.address.contains).toBe("15595 Curtis");
    expect(result).toEqual(fixture);
  });

  it("does not fall back when the strict match already finds results", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValueOnce([{ mlsNumber: "X" }] as any);

    await findSubjectProperty(prisma as any, "15595 Curtis Circle", "95370");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not fall back when there is no street name left after stripping the last word", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await findSubjectProperty(prisma as any, "15595", "95370");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(1);
  });

  it("falls back to a directional-translated match when the geocoder spells out the directional prefix but MLS data abbreviates it", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [
      {
        mlsNumber: "ML-DIR-1",
        status: "Closed",
        beds: 3,
        baths: 2,
        sqft: 1600,
        lotSize: null,
        listPrice: null,
        closePrice: 900000,
        closeDate: new Date("2025-03-01"),
        listedAt: new Date("2024-10-01"),
      },
    ];

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict "1600 North Highland Avenue" — no match
      .mockResolvedValueOnce([]) // suffix-dropped "1600 North Highland" — no match, "North" still unresolved
      .mockResolvedValueOnce(fixture as any); // directional-translated "1600 N Highland" — matches

    const result = await findSubjectProperty(prisma as any, "1600 North Highland Avenue", "90028");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(3);
    const directionalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(directionalCall.where.zip).toBe("90028");
    expect(directionalCall.where.address.contains).toBe("1600 N Highland");
    expect(result).toEqual(fixture);
  });

  it("translates other directional words too, not just North", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [{ mlsNumber: "ML-DIR-2" }];

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(fixture as any);

    await findSubjectProperty(prisma as any, "500 Northeast Elm Drive", "97201");

    const directionalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(directionalCall.where.address.contains).toBe("500 NE Elm");
  });

  it("does not drop the street name when there is no suffix word to strip (3-word directional address)", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [{ mlsNumber: "ML-DIR-3" }];

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(fixture as any);

    const result = await findSubjectProperty(prisma as any, "100 North Broadway", "90028");

    const directionalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(directionalCall.where.address.contains).toBe("100 N Broadway");
    expect(result).toEqual(fixture);
  });

  it("does not attempt a third query when no directional word is present", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict — no match
      .mockResolvedValueOnce([]); // suffix-dropped — no match, and no directional to try

    const result = await findSubjectProperty(prisma as any, "123 Main Street", "91101");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it("falls back to lat/lng proximity when all text tiers fail and returns the closest match within 100m", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const near = { mlsNumber: "ML-NEAR", status: "Active", beds: 4, baths: 2, sqft: 1800, lotSize: null, listPrice: 900000, closePrice: null, closeDate: null, listedAt: new Date(), propertyType: null, yearBuilt: null, county: null, photos: [], latitude: 37.95856776, longitude: -120.28303432 };
    const far = { mlsNumber: "ML-FAR", status: "Active", beds: 3, baths: 2, sqft: 1500, lotSize: null, listPrice: 700000, closePrice: null, closeDate: null, listedAt: new Date(), propertyType: null, yearBuilt: null, county: null, photos: [], latitude: 37.97, longitude: -120.30 };

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict
      .mockResolvedValueOnce([]) // suffix-dropped
      .mockResolvedValueOnce([near, far] as any); // proximity box query

    const result = await findSubjectProperty(prisma as any, "18521 Woodhams Carne Road", "95370", 37.95856776, -120.28303432);

    expect(result).toHaveLength(1);
    expect(result[0].mlsNumber).toBe("ML-NEAR");
  });

  it("strips latitude/longitude from the returned records", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const near = { mlsNumber: "ML-NEAR", status: "Active", beds: 4, baths: 2, sqft: 1800, lotSize: null, listPrice: 900000, closePrice: null, closeDate: null, listedAt: new Date(), propertyType: null, yearBuilt: null, county: null, photos: [], latitude: 37.95856776, longitude: -120.28303432 };

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([near] as any);

    const result = await findSubjectProperty(prisma as any, "18521 Woodhams Carne Road", "95370", 37.95856776, -120.28303432);

    expect(result[0]).not.toHaveProperty("latitude");
    expect(result[0]).not.toHaveProperty("longitude");
  });

  it("returns empty and makes no proximity query when lat/lng are omitted", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict
      .mockResolvedValueOnce([]); // suffix-dropped

    const result = await findSubjectProperty(prisma as any, "123 Main Street", "91101");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it("returns empty and makes no proximity query when lat or lng fails to parse to NaN", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict
      .mockResolvedValueOnce([]); // suffix-dropped

    const result = await findSubjectProperty(prisma as any, "123 Main Street", "91101", NaN, -120.283);

    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });
});

describe("findComps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries Closed status, non-null closePrice, exact zip, and a 6-month window first", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([{}, {}, {}] as any);

    await findComps(prisma as any, { zip: "91101", beds: 3 });

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.status).toBe("Closed");
    expect(call.where.closePrice.not).toBeNull();
    expect(call.where.zip).toBe("91101");
    expect(call.where.beds).toEqual({ gte: 2, lte: 4 });
    expect(call.orderBy).toEqual({ closeDate: "desc" });
  });

  it("returns immediately once a window yields >= 3 comps", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValueOnce([{}, {}, {}] as any);

    const result = await findComps(prisma as any, { zip: "91101", beds: 3 });

    expect(result).toHaveLength(3);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(1);
  });

  it("widens the time window when fewer than 3 comps are found", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([{}] as any) // 6mo: 1 comp, not enough
      .mockResolvedValueOnce([{}, {}, {}, {}] as any); // 12mo: 4 comps, enough

    const result = await findComps(prisma as any, { zip: "91101", beds: 3 });

    expect(result).toHaveLength(4);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
  });

  it("drops the beds and propertyType constraints as a final fallback after all time windows fail", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([] as any) // 6mo
      .mockResolvedValueOnce([{}] as any) // 12mo
      .mockResolvedValueOnce([{}, {}] as any); // final fallback, no beds/propertyType filter

    const result = await findComps(prisma as any, {
      zip: "91101",
      beds: 3,
      propertyType: "SingleFamilyResidence",
    });

    expect(result).toHaveLength(2);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(3);
    const finalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(finalCall.where.beds).toBeUndefined();
    expect(finalCall.where.propertyType).toBeUndefined();
  });

  it("caps the widest window at 12 months (one year), never reaching further back", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([] as any) // 6mo
      .mockResolvedValueOnce([] as any) // 12mo
      .mockResolvedValueOnce([] as any); // final fallback, still 12mo

    await findComps(prisma as any, { zip: "91101", beds: 3 });

    const finalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    expect(finalCall.where.closeDate.gte.toISOString().slice(0, 10)).toBe(
      twelveMonthsAgo.toISOString().slice(0, 10)
    );
  });

  it("includes propertyType in the where clause when provided", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([{}, {}, {}] as any);

    await findComps(prisma as any, { zip: "91101", beds: 3, propertyType: "Condominium" });

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.propertyType).toBe("Condominium");
  });

  it("excludes the subject's own mlsNumber when provided", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([{}, {}, {}] as any);

    await findComps(prisma as any, { zip: "91101", beds: 3, excludeMlsNumber: "ML1" });

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.mlsNumber).toEqual({ not: "ML1" });
  });

  it("only matches FOR_SALE listings, excluding closed rentals from comps", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([{}, {}, {}] as any);

    await findComps(prisma as any, { zip: "91101", beds: 3 });

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.listingType).toBe("FOR_SALE");
  });

  it("keeps the FOR_SALE filter even at the final fallback that drops beds/propertyType", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findComps } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([] as any) // 6mo
      .mockResolvedValueOnce([] as any) // 12mo
      .mockResolvedValueOnce([{}, {}] as any); // final fallback

    await findComps(prisma as any, { zip: "91101", beds: 3 });

    const finalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(finalCall.where.listingType).toBe("FOR_SALE");
  });
});

describe("formatPriceShort", () => {
  it("formats sub-million prices as rounded thousands", async () => {
    const { formatPriceShort } = await import("@/lib/home-value-estimate");
    expect(formatPriceShort(725000)).toBe("$725K");
  });

  it("formats million-plus prices with two decimal places", async () => {
    const { formatPriceShort } = await import("@/lib/home-value-estimate");
    expect(formatPriceShort(1250000)).toBe("$1.25M");
  });

  it("formats an exact million without trailing decimals", async () => {
    const { formatPriceShort } = await import("@/lib/home-value-estimate");
    expect(formatPriceShort(2000000)).toBe("$2M");
  });
});

describe("pickBinWidth", () => {
  it("picks the smallest nice step that keeps bins at or under the target of 6", async () => {
    const { pickBinWidth } = await import("@/lib/home-value-estimate");
    // range 500000, step 100000 -> 5 bins, fits
    expect(pickBinWidth(400000, 900000)).toBe(100000);
  });

  it("falls back to the largest step for a very wide range", async () => {
    const { pickBinWidth } = await import("@/lib/home-value-estimate");
    expect(pickBinWidth(100000, 50000000)).toBe(5000000);
  });

  it("handles min === max without dividing by zero", async () => {
    const { pickBinWidth } = await import("@/lib/home-value-estimate");
    expect(pickBinWidth(500000, 500000)).toBe(10000);
  });
});

describe("buildPriceBars", () => {
  it("returns an empty array for zero sales", async () => {
    const { buildPriceBars } = await import("@/lib/home-value-estimate");
    expect(buildPriceBars([])).toEqual([]);
  });

  it("returns one bar per sale, sorted by price ascending, when below the sparse threshold", async () => {
    const { buildPriceBars } = await import("@/lib/home-value-estimate");
    const bars = buildPriceBars([
      { closePrice: 900000 },
      { closePrice: 500000 },
      { closePrice: 700000 },
    ]);
    expect(bars).toEqual([
      { label: "$500K", value: 500000 },
      { label: "$700K", value: 700000 },
      { label: "$900K", value: 900000 },
    ]);
  });

  it("bins into a price histogram at 5 or more sales, with count on each bar", async () => {
    const { buildPriceBars } = await import("@/lib/home-value-estimate");
    const sales = [
      { closePrice: 410000 },
      { closePrice: 420000 },
      { closePrice: 830000 },
      { closePrice: 840000 },
      { closePrice: 850000 },
    ];
    const bars = buildPriceBars(sales);
    const total = bars.reduce((sum, b) => sum + (b.count ?? 0), 0);
    expect(total).toBe(5);
    expect(bars.every((b) => b.count != null)).toBe(true);
    expect(bars.every((b) => b.label.includes("–"))).toBe(true);
  });
});

describe("getMarketSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries a flat trailing-one-year window", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await getMarketSnapshot(prisma as any, "91101");

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    const expectedSince = new Date("2026-07-12T12:00:00Z");
    expectedSince.setFullYear(expectedSince.getFullYear() - 1);
    expect(call.where.closeDate.gte.toISOString().slice(0, 10)).toBe(
      expectedSince.toISOString().slice(0, 10)
    );
  });

  it("only counts FOR_SALE listings, excluding closed rentals", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    await getMarketSnapshot(prisma as any, "91101");

    const call = vi.mocked(prisma.property.findMany).mock.calls[0][0] as any;
    expect(call.where.listingType).toBe("FOR_SALE");
  });

  it("returns an empty bars array and null median when there are no sales", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);

    const result = await getMarketSnapshot(prisma as any, "91101");

    expect(result.bars).toEqual([]);
    expect(result.medianPrice).toBeNull();
  });

  it("computes the median price across all sales in the window", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { getMarketSnapshot } = await import("@/lib/home-value-estimate");
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { closePrice: 700000 },
      { closePrice: 900000 },
      { closePrice: 800000 },
    ] as any);

    const result = await getMarketSnapshot(prisma as any, "91101");

    expect(result.medianPrice).toBe(800000);
  });
});
