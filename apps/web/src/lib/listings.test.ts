import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getFeaturedListings } from "./listings";

describe("getFeaturedListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the top 8 Active/ComingSoon/ActiveUnderContract listings in the given city, ordered by newest first", async () => {
    (prisma.property.findMany as any).mockResolvedValue([]);

    await getFeaturedListings("Los Angeles");

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: "Los Angeles", mode: "insensitive" },
      },
      orderBy: { listedAt: "desc" },
      take: 8,
      select: {
        mlsNumber: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        address: true,
        city: true,
        status: true,
        photos: true,
      },
    });
  });

  it("maps photos to an array, defaulting to an empty array when not an array", async () => {
    (prisma.property.findMany as any).mockResolvedValue([
      {
        mlsNumber: "123",
        listPrice: 500000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        address: "1 Main St",
        city: "LA",
        status: "Active",
        photos: null,
      },
    ]);

    const result = await getFeaturedListings("Los Angeles");

    expect(result[0].photos).toEqual([]);
    expect(result[0].address).toBe("1 Main St");
  });

  it("returns an empty array on query failure instead of throwing", async () => {
    (prisma.property.findMany as any).mockRejectedValue(new Error("db unreachable"));

    const result = await getFeaturedListings("Los Angeles");

    expect(result).toEqual([]);
  });
});
