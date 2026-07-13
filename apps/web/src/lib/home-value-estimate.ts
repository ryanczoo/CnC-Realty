import type { PrismaClient } from "@cnc/database";
import { Prisma } from "@cnc/database";

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
  propertyType: string | null;
  yearBuilt: number | null;
  county: string | null;
  photos: unknown;
}

export function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === "string") return photos[0];
  return null;
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

const SUBJECT_SELECT = {
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
  propertyType: true,
  yearBuilt: true,
  county: true,
  photos: true,
} as const;

const DIRECTIONALS: Record<string, string> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
};

// Note: this only resolves a directional *prefix* (the common case in CA
// addressing). A trailing directional suffix (e.g. "123 Main St NE") is
// stored by the IDX sync but not resolved here — out of scope for now.

export async function findSubjectProperty(
  prisma: PrismaClient,
  address: string,
  zip: string
): Promise<SubjectRecord[]> {
  const strict = await prisma.property.findMany({
    where: {
      zip,
      address: { contains: address, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
  });
  if (strict.length > 0) return strict;

  // Geocoders spell street types out in full (e.g. "Circle") while MLS data
  // uses USPS abbreviations (e.g. "Cir") — retry without the trailing word so
  // "15595 Curtis Circle" still matches a stored "15595 Curtis Cir".
  const words = address.trim().split(/\s+/);
  if (words.length < 2) return [];
  const withoutSuffix = words.slice(0, -1).join(" ");

  const suffixDropped = await prisma.property.findMany({
    where: {
      zip,
      address: { contains: withoutSuffix, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
  });
  if (suffixDropped.length > 0) return suffixDropped;

  // Geocoders also spell directionals out in full (e.g. "North") while MLS
  // data abbreviates them (e.g. "N"). Unlike the suffix, a directional sits
  // mid-string (right after the house number), so it must be translated to
  // its abbreviation rather than dropped — dropping it wouldn't realign with
  // the abbreviated form still present in the stored address.
  const directional = DIRECTIONALS[words[1]?.toLowerCase()];
  if (!directional) return [];
  // A 3-word address (number + directional + street name) has no suffix
  // word to drop; 4+ words means there's a real suffix beyond the street
  // name, same as Pass 2's logic.
  const rest = words.length > 3 ? words.slice(2, -1) : words.slice(2);
  const withDirectionalAbbreviated = [words[0], directional, ...rest].join(" ");

  return prisma.property.findMany({
    where: {
      zip,
      address: { contains: withDirectionalAbbreviated, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
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
  propertyType?: string | null;
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
  propertyType: string | null,
  excludeMlsNumber?: string
): Promise<CompRecord[]> {
  const closeDateAfter = new Date();
  closeDateAfter.setMonth(closeDateAfter.getMonth() - months);

  const where: Prisma.PropertyWhereInput = {
    status: "Closed",
    listingType: "FOR_SALE",
    closePrice: { not: null },
    zip,
    closeDate: { gte: closeDateAfter },
  };
  if (excludeMlsNumber) where.mlsNumber = { not: excludeMlsNumber };
  if (beds != null) where.beds = { gte: beds - 1, lte: beds + 1 };
  if (propertyType) where.propertyType = propertyType;

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
  const propertyType = params.propertyType ?? null;
  for (const months of WINDOW_MONTHS) {
    const rows = await queryComps(prisma, params.zip, months, params.beds, propertyType, params.excludeMlsNumber);
    if (rows.length >= MIN_COMPS) return rows;
  }
  // Final fallback: widest window, no beds or propertyType constraint
  return queryComps(
    prisma,
    params.zip,
    WINDOW_MONTHS[WINDOW_MONTHS.length - 1],
    null,
    null,
    params.excludeMlsNumber
  );
}

export interface PriceBar {
  label: string;
  value: number;
  count?: number;
}

const NICE_STEPS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];
const TARGET_BINS = 6;
const SPARSE_THRESHOLD = 5;

export function formatPriceShort(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `$${Math.round(n / 1000)}K`;
}

export function pickBinWidth(min: number, max: number): number {
  const range = Math.max(max - min, 1);
  for (const step of NICE_STEPS) {
    if (Math.ceil(range / step) <= TARGET_BINS) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

export function buildPriceBars(sales: { closePrice: number }[]): PriceBar[] {
  if (sales.length === 0) return [];

  if (sales.length < SPARSE_THRESHOLD) {
    return [...sales]
      .sort((a, b) => a.closePrice - b.closePrice)
      .map((s) => ({ label: formatPriceShort(s.closePrice), value: s.closePrice }));
  }

  const prices = sales.map((s) => s.closePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const width = pickBinWidth(min, max);
  const startBin = Math.floor(min / width) * width;

  const bins = new Map<number, number>();
  for (const price of prices) {
    const binStart = startBin + Math.floor((price - startBin) / width) * width;
    bins.set(binStart, (bins.get(binStart) ?? 0) + 1);
  }

  return Array.from(bins.entries())
    .sort(([a], [b]) => a - b)
    .map(([binStart, count]) => ({
      label: `${formatPriceShort(binStart)}–${formatPriceShort(binStart + width)}`,
      value: count,
      count,
    }));
}

export async function getMarketSnapshot(
  prisma: PrismaClient,
  zip: string
): Promise<{ bars: PriceBar[]; medianPrice: number | null }> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const rows = await prisma.property.findMany({
    where: { status: "Closed", listingType: "FOR_SALE", zip, closePrice: { not: null }, closeDate: { gte: since } },
    select: { closePrice: true },
  });

  const sales = rows.map((r) => ({ closePrice: r.closePrice as number }));
  const prices = sales.map((s) => s.closePrice).sort((a, b) => a - b);

  return {
    bars: buildPriceBars(sales),
    medianPrice: prices.length ? percentile(prices, 0.5) : null,
  };
}
