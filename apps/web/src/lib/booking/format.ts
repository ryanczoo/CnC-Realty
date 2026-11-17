import { BOOKING_RULES } from "./rules";

const tz = BOOKING_RULES.timeZone;

export function formatTimePT(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

export function formatSlotPT(d: Date): string {
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
  return `${date} · ${formatTimePT(d)} PT`;
}
