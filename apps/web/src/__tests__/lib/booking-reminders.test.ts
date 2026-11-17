import { describe, it, expect } from "vitest";
import { reminderDue } from "@/lib/booking/reminders";

const H = 3_600_000;
const startsAt = new Date("2026-11-20T18:00:00Z");
const at = (msBefore: number) => new Date(startsAt.getTime() - msBefore);
const base = { startsAt, scheduledAt: new Date(startsAt.getTime() - 72 * H), reminder24SentAt: null, reminder1SentAt: null };

describe("reminderDue", () => {
  it("24h when booked days ahead and 23h out", () => {
    expect(reminderDue(base, at(23 * H))).toBe("24h");
  });
  it("null when booked 2h before the call and 23h out", () => {
    expect(reminderDue({ ...base, scheduledAt: at(2 * H) }, at(23 * H))).toBeNull();
  });
  it("1h at 50 minutes", () => {
    expect(reminderDue(base, at(50 * 60_000))).toBe("1h");
  });
  it("null when the 1h reminder was already sent", () => {
    expect(reminderDue({ ...base, reminder1SentAt: new Date() }, at(50 * 60_000))).toBeNull();
  });
  it("null at 20h when 24h was already sent", () => {
    expect(reminderDue({ ...base, reminder24SentAt: new Date() }, at(20 * H))).toBeNull();
  });
  it("null once the call has started", () => {
    expect(reminderDue(base, at(-60_000))).toBeNull();
  });
});
