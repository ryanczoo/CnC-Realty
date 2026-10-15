// Stops for the Price slider: fine steps where most homes are, coarser above.
// Zillow uses the same small-then-larger pattern (57 stops; ours 68).
const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const PRICE_STEPS: readonly number[] = [
  ...range(0, 1_000_000, 25_000),
  ...range(1_100_000, 2_000_000, 100_000),
  ...range(2_250_000, 5_000_000, 250_000),
  ...range(6_000_000, 10_000_000, 1_000_000),
];
export const LAST_STEP = PRICE_STEPS.length - 1; // means "$10M+", no max

export function minIndexFor(value: string): number {
  const v = Number(value);
  if (!value || !Number.isFinite(v) || v <= 0) return 0;
  let i = 0;
  while (i < LAST_STEP && PRICE_STEPS[i + 1] <= v) i++;
  return i;
}

export function maxIndexFor(value: string): number {
  const v = Number(value);
  if (!value || !Number.isFinite(v)) return LAST_STEP;
  const i = PRICE_STEPS.findIndex((s) => s >= v);
  return i === -1 ? LAST_STEP : i;
}

export const minValueAt = (i: number) => (i <= 0 ? "" : String(PRICE_STEPS[i]));
export const maxValueAt = (i: number) => (i >= LAST_STEP ? "" : String(PRICE_STEPS[i]));

export function stepLabel(i: number): string {
  if (i >= LAST_STEP) return "$10M+";
  const n = PRICE_STEPS[i];
  if (n === 0) return "$0";
  return n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(2)}M` : `$${n / 1_000}K`;
}

export function normalizePriceDraft(min: string, max: string): { minPrice: string; maxPrice: string } {
  if (min && max && Number(min) > Number(max)) return { minPrice: max, maxPrice: min };
  return { minPrice: min, maxPrice: max };
}
