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

export function formatCompactCurrency(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}
