import { describe, it, expect } from "vitest";
import { openSlots, isOpenSlot, groupByPacificDate, pacificWallTimeToUtc } from "@/lib/booking/slots";

const at = (iso: string) => new Date(iso);

describe("booking slots", () => {
  it("first slot of a November day is 8:00 PST = 16:00Z", () => {
    const s = openSlots(at("2026-11-16T15:00:00Z"), []);
    expect(s[0].toISOString()).toBe("2026-11-16T16:00:00.000Z");
  });
  it("48 slots per full day, last one 19:45 PT", () => {
    const day = groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), []))["2026-11-17"];
    expect(day).toHaveLength(48);
    expect(day[47]).toBe("2026-11-18T03:45:00.000Z");
  });
  it("Sunday is open", () => {
    expect(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), []))["2026-11-22"]).toHaveLength(48);
  });
  it("window is today through today+14, inclusive", () => {
    const days = Object.keys(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), [])));
    expect(days[0]).toBe("2026-11-16");
    expect(days.at(-1)).toBe("2026-11-30");
    expect(days).toHaveLength(15);
  });
  it("15-minute notice: at 8:05 PT the first slot is 8:30", () => {
    expect(openSlots(at("2026-11-16T16:05:00Z"), [])[0].toISOString()).toBe("2026-11-16T16:30:00.000Z");
  });
  it("a slot exactly 15 minutes away is allowed", () => {
    expect(openSlots(at("2026-11-16T16:00:00Z"), [])[0].toISOString()).toBe("2026-11-16T16:15:00.000Z");
  });
  it("busy 10:05–10:20 PT removes 10:00 and 10:15 only", () => {
    const busy = [{ start: at("2026-11-17T18:05:00Z"), end: at("2026-11-17T18:20:00Z") }];
    const day = groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), busy))["2026-11-17"];
    expect(day).not.toContain("2026-11-17T18:00:00.000Z");
    expect(day).not.toContain("2026-11-17T18:15:00.000Z");
    expect(day).toContain("2026-11-17T18:30:00.000Z");
  });
  it("busy ending exactly at a slot start does not block it", () => {
    const busy = [{ start: at("2026-11-17T17:00:00Z"), end: at("2026-11-17T18:00:00Z") }];
    expect(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), busy))["2026-11-17"]).toContain("2026-11-17T18:00:00.000Z");
  });
  it("an all-day busy block closes the day", () => {
    const busy = [{ start: at("2026-11-20T08:00:00Z"), end: at("2026-11-21T08:00:00Z") }];
    expect(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), busy))["2026-11-20"]).toBeUndefined();
  });
  it("after 7:30 PT today has no slots", () => {
    expect(groupByPacificDate(openSlots(at("2026-11-17T03:31:00Z"), []))["2026-11-16"]).toBeUndefined();
  });
  it("DST spring-forward day: 8:00 PDT = 15:00Z", () => {
    expect(pacificWallTimeToUtc("2027-03-14", 8, 0).toISOString()).toBe("2027-03-14T15:00:00.000Z");
  });
  it("DST fall-back day: 8:00 PST = 16:00Z", () => {
    expect(pacificWallTimeToUtc("2026-11-01", 8, 0).toISOString()).toBe("2026-11-01T16:00:00.000Z");
  });
  it("isOpenSlot rejects a time off the 15-minute grid", () => {
    expect(isOpenSlot(at("2026-11-17T18:05:00Z"), at("2026-11-16T15:00:00Z"), [])).toBe(false);
  });
  it("isOpenSlot accepts an open grid slot and rejects a busy one", () => {
    const now = at("2026-11-16T15:00:00Z");
    expect(isOpenSlot(at("2026-11-17T18:00:00Z"), now, [])).toBe(true);
    expect(isOpenSlot(at("2026-11-17T18:00:00Z"), now, [{ start: at("2026-11-17T18:00:00Z"), end: at("2026-11-17T18:15:00Z") }])).toBe(false);
  });
});
