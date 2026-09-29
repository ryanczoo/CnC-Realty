// Page-number list for numbered pagination: every page when there are 7 or
// fewer, otherwise first, last, and the pages either side of the current one.
export function getPageNums(cur: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  if (cur > 3) out.push("...");
  const lo = Math.max(2, cur - 1);
  const hi = Math.min(total - 1, cur + 1);
  for (let i = lo; i <= hi; i++) out.push(i);
  if (cur < total - 2) out.push("...");
  out.push(total);
  return out;
}

// A ?page= search param as a page number; anything that isn't a positive
// whole number is page 1.
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 ? page : 1;
}
