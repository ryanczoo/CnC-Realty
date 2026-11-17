import { BOOKING_RULES } from "./rules";

const tz = BOOKING_RULES.timeZone;

// Newer ICU (Vercel/Node) emits U+202F before AM/PM; some browsers emit a plain space. Normalize so SSR and client text match.
const plainSpaces = (s: string) => s.replace(/[  ]/g, " ");

export function formatTimePT(d: Date): string {
  return plainSpaces(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d));
}

export function formatSlotPT(d: Date): string {
  const date = plainSpaces(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d));
  return `${date} · ${formatTimePT(d)} PT`;
}
