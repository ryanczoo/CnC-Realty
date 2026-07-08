import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

export interface CompInput {
  closePrice: number;
  sqft: number;
}

export interface EstimateResult {
  pointEstimate: number;
  rangeLow: number;
  rangeHigh: number;
  compCount: number;
}

export interface SubjectRecord {
  mlsNumber: string;
  status: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  listPrice: number;
  closePrice: number | null;
  closeDate: Date | null;
  listedAt: Date | null;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeEstimate(
  comps: CompInput[],
  subjectSqft: number | null
): EstimateResult | null {
  if (!subjectSqft || subjectSqft <= 0) return null;

  const pricesPerSqft = comps
    .filter((c) => c.sqft > 0 && c.closePrice > 0)
    .map((c) => c.closePrice / c.sqft)
    .sort((a, b) => a - b);

  if (pricesPerSqft.length === 0) return null;

  const median = percentile(pricesPerSqft, 0.5);
  const p25 = percentile(pricesPerSqft, 0.25);
  const p75 = percentile(pricesPerSqft, 0.75);

  return {
    pointEstimate: Math.round(median * subjectSqft),
    rangeLow: Math.round(p25 * subjectSqft),
    rangeHigh: Math.round(p75 * subjectSqft),
    compCount: pricesPerSqft.length,
  };
}

export async function findSubjectProperty(
  prisma: PrismaClient,
  address: string,
  zip: string
): Promise<SubjectRecord[]> {
  return prisma.property.findMany({
    where: {
      zip,
      address: { contains: address, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: {
      mlsNumber: true,
      status: true,
      beds: true,
      baths: true,
      sqft: true,
      lotSize: true,
      listPrice: true,
      closePrice: true,
      closeDate: true,
      listedAt: true,
    },
  });
}

export interface CompRecord {
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  closePrice: number;
  closeDate: Date;
  photos: unknown;
}

export interface FindCompsParams {
  zip: string;
  beds: number | null;
  excludeMlsNumber?: string;
}

const MIN_COMPS = 3;
const WINDOW_MONTHS = [6, 12, 24];
const COMPS_SELECT = {
  mlsNumber: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  beds: true,
  baths: true,
  sqft: true,
  closePrice: true,
  closeDate: true,
  photos: true,
} as const;

async function queryComps(
  prisma: PrismaClient,
  zip: string,
  months: number,
  beds: number | null,
  excludeMlsNumber?: string
): Promise<CompRecord[]> {
  const closeDateAfter = new Date();
  closeDateAfter.setMonth(closeDateAfter.getMonth() - months);

  const where: Prisma.PropertyWhereInput = {
    status: "Closed",
    closePrice: { not: null },
    zip,
    closeDate: { gte: closeDateAfter },
  };
  if (excludeMlsNumber) where.mlsNumber = { not: excludeMlsNumber };
  if (beds != null) where.beds = { gte: beds - 1, lte: beds + 1 };

  return prisma.property.findMany({
    where,
    orderBy: { closeDate: "desc" },
    take: 25,
    select: COMPS_SELECT,
  }) as unknown as Promise<CompRecord[]>;
}

export async function findComps(
  prisma: PrismaClient,
  params: FindCompsParams
): Promise<CompRecord[]> {
  for (const months of WINDOW_MONTHS) {
    const rows = await queryComps(prisma, params.zip, months, params.beds, params.excludeMlsNumber);
    if (rows.length >= MIN_COMPS) return rows;
  }
  // Final fallback: widest window, no beds constraint
  return queryComps(prisma, params.zip, WINDOW_MONTHS[WINDOW_MONTHS.length - 1], null, params.excludeMlsNumber);
}

export interface QuarterStat {
  label: string;
  count: number;
  medianPrice: number | null;
}

function lastFourQuarters(): { label: string; start: Date; end: Date }[] {
  const now = new Date();
  const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const result: { label: string; start: Date; end: Date }[] = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(now.getFullYear(), currentQuarterStartMonth - i * 3, 1);
    const end = new Date(now.getFullYear(), currentQuarterStartMonth - i * 3 + 3, 1);
    const q = Math.floor(start.getMonth() / 3) + 1;
    result.push({ label: `${start.getFullYear()} Q${q}`, start, end });
  }
  return result;
}

export async function getMarketSnapshot(
  prisma: PrismaClient,
  zip: string
): Promise<QuarterStat[]> {
  const quarters = lastFourQuarters();
  const since = quarters[0].start;

  const rows = await prisma.property.findMany({
    where: { status: "Closed", zip, closePrice: { not: null }, closeDate: { gte: since } },
    select: { closePrice: true, closeDate: true },
  });

  return quarters.map(({ label, start, end }) => {
    const inQuarter = rows.filter(
      (r) => r.closeDate && r.closeDate >= start && r.closeDate < end
    );
    const prices = inQuarter
      .map((r) => r.closePrice as number)
      .sort((a, b) => a - b);
    return {
      label,
      count: inQuarter.length,
      medianPrice: prices.length ? percentile(prices, 0.5) : null,
    };
  });
}
