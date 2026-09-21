import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toSentenceCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Date-only fields (offer date, deadlines, close of escrow…) are stored as UTC
// midnight, so they must be formatted in UTC. Formatting them in local time
// shows the previous day in California. Use formatDate for real timestamps.
export function formatDateOnly(
  d: Date | string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" }
): string {
  return new Date(d).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

// True when a date-only field (stored as UTC midnight) is on a calendar day before
// today's LOCAL calendar day. Due today is not past due.
export function isDateOnlyPast(d: Date | string, now: Date = new Date()): boolean {
  const t = new Date(d);
  const dueDay = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay < today;
}

export function formatCompactCurrency(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}
