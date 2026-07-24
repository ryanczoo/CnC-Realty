import { prisma } from "@/lib/prisma";

export const FALLBACK_CITY = "Los Angeles";
export const MIN_LISTINGS = 4;

const MATCHING_STATUSES = ["Active", "ComingSoon", "ActiveUnderContract"];

export function parseCityHeader(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

async function countListingsInCity(city: string): Promise<number> {
  return prisma.property.count({
    where: {
      status: { in: MATCHING_STATUSES },
      city: { equals: city, mode: "insensitive" },
    },
  });
}

export async function resolveVisitorCity(
  candidateCity: string | null
): Promise<{ city: string; count: number }> {
  try {
    if (candidateCity) {
      const count = await countListingsInCity(candidateCity);
      if (count >= MIN_LISTINGS) {
        return { city: candidateCity, count };
      }
    }

    const fallbackCount = await countListingsInCity(FALLBACK_CITY);
    return { city: FALLBACK_CITY, count: fallbackCount };
  } catch {
    return { city: FALLBACK_CITY, count: 0 };
  }
}
