import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { parseCityHeader, resolveVisitorCity, FALLBACK_CITY, MIN_LISTINGS } from "./visitor-city";

describe("parseCityHeader", () => {
  it("URL-decodes a city header value", () => {
    expect(parseCityHeader("San%20Francisco")).toBe("San Francisco");
  });

  it("returns null when the header is missing", () => {
    expect(parseCityHeader(null)).toBeNull();
  });

  it("returns null when the decoded value is empty or whitespace-only", () => {
    expect(parseCityHeader("   ")).toBeNull();
  });
});

describe("resolveVisitorCity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the candidate city when it has at least MIN_LISTINGS matching listings", async () => {
    (prisma.property.count as any).mockResolvedValue(10);

    const result = await resolveVisitorCity("Pasadena");

    expect(result).toEqual({ city: "Pasadena", count: 10 });
    expect(prisma.property.count).toHaveBeenCalledWith({
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: "Pasadena", mode: "insensitive" },
      },
    });
  });

  it("uses the candidate city when its count is exactly MIN_LISTINGS", async () => {
    (prisma.property.count as any).mockResolvedValue(MIN_LISTINGS);

    const result = await resolveVisitorCity("Pasadena");

    expect(result).toEqual({ city: "Pasadena", count: MIN_LISTINGS });
  });

  it(`falls back to ${FALLBACK_CITY} when the candidate city has fewer than MIN_LISTINGS matching listings`, async () => {
    (prisma.property.count as any)
      .mockResolvedValueOnce(MIN_LISTINGS - 1)
      .mockResolvedValueOnce(500);

    const result = await resolveVisitorCity("Tiny Town");

    expect(result).toEqual({ city: FALLBACK_CITY, count: 500 });
    expect(prisma.property.count).toHaveBeenNthCalledWith(2, {
      where: {
        status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] },
        city: { equals: FALLBACK_CITY, mode: "insensitive" },
      },
    });
  });

  it(`falls back to ${FALLBACK_CITY} when no candidate city was detected`, async () => {
    (prisma.property.count as any).mockResolvedValue(500);

    const result = await resolveVisitorCity(null);

    expect(result).toEqual({ city: FALLBACK_CITY, count: 500 });
    expect(prisma.property.count).toHaveBeenCalledTimes(1);
  });

  it(`returns ${FALLBACK_CITY} with count 0 when the database is unreachable`, async () => {
    (prisma.property.count as any).mockRejectedValue(new Error("db unreachable"));

    const result = await resolveVisitorCity("Pasadena");

    expect(result).toEqual({ city: FALLBACK_CITY, count: 0 });
  });
});
