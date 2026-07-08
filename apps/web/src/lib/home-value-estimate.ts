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
