// Pure calendar-grid helpers for the booking calendar. Dates are plain
// "YYYY-MM-DD" strings (already Pacific dates from the slots API), so all the
// math here runs in UTC to stay independent of the visitor's device zone.

const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

/** Sunday-first month cells: "YYYY-MM-DD" for each day, null padding, length a multiple of 7. */
export function buildMonthGrid(year: number, month0: number): (string | null)[] {
  const lead = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(year, month0, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export type MonthRef = { year: number; month0: number };

/** Every month touched by the inclusive window [startYmd, endYmd]. */
export function windowMonths(startYmd: string, endYmd: string): MonthRef[] {
  const [sy, sm] = startYmd.split("-").map(Number);
  const [ey, em] = endYmd.split("-").map(Number);
  const out: MonthRef[] = [];
  let y = sy;
  let m = sm - 1;
  while (y < ey || (y === ey && m <= em - 1)) {
    out.push({ year: y, month0: m });
    m++;
    if (m === 12) { m = 0; y++; }
  }
  return out;
}

function noonUtc(ymdStr: string): Date {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "Tuesday, November 17" — used as the day cell's aria-label. */
export function dayLabel(ymdStr: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })
    .format(noonUtc(ymdStr));
}

/** "November 2026" — the month header. */
export function monthTitle(year: number, month0: number): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" })
    .format(new Date(Date.UTC(year, month0, 1, 12)));
}

/** Earliest date with at least one open slot, or null. */
export function firstOpenDay(days: Record<string, string[]>): string | null {
  return Object.keys(days).filter((k) => days[k].length > 0).sort()[0] ?? null;
}
