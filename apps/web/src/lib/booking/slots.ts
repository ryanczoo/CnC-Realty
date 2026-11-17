import { BOOKING_RULES } from "./rules";

export type Interval = { start: Date; end: Date };

const MIN = 60_000;

// Wall-clock parts of an instant in Pacific, via Intl (independent of machine zone).
function pacificParts(d: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_RULES.timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

export function pacificDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_RULES.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Pacific wall-clock time -> UTC instant. DST-correct: find the zone offset at a
// candidate instant, adjust, and re-check once (covers the offset changing nearby).
export function pacificWallTimeToUtc(ymd: string, h: number, m: number): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, m);
  const wallAsUtc = (t: number) => {
    const p = pacificParts(new Date(t));
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  };
  let t = wanted - (wallAsUtc(wanted) - wanted);
  const diff = wallAsUtc(t) - wanted;
  if (diff !== 0) t -= diff;
  return new Date(t);
}

function addDays(ymd: string, n: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

export function openSlots(now: Date, busy: Interval[], rules = BOOKING_RULES): Date[] {
  const earliest = now.getTime() + rules.minNoticeMinutes * MIN;
  const slotMs = rules.slotMinutes * MIN;
  const today = pacificDate(now);
  const out: Date[] = [];
  for (let i = 0; i <= rules.windowDays; i++) {
    const ymd = addDays(today, i);
    const first = pacificWallTimeToUtc(ymd, rules.firstSlot.h, rules.firstSlot.m).getTime();
    const last = pacificWallTimeToUtc(ymd, rules.lastSlot.h, rules.lastSlot.m).getTime();
    for (let s = first; s <= last; s += slotMs) {
      if (s < earliest) continue;
      if (busy.some((b) => s < b.end.getTime() && s + slotMs > b.start.getTime())) continue;
      out.push(new Date(s));
    }
  }
  return out;
}

export function isOpenSlot(start: Date, now: Date, busy: Interval[]): boolean {
  const t = start.getTime();
  return openSlots(now, busy).some((s) => s.getTime() === t);
}

export function groupByPacificDate(slots: Date[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of slots) (out[pacificDate(s)] ??= []).push(s.toISOString());
  return out;
}
