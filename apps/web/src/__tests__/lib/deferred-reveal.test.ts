import { describe, it, expect } from "vitest";
import { shouldRevealCalendar, isNearViewport, IDLE_FALLBACK_MS, NEAR_ROOT_MARGIN } from "@/lib/deferred-reveal";

describe("shouldRevealCalendar", () => {
  it("waits for page load, idle, and nearness together", () => {
    expect(shouldRevealCalendar({ loaded: false, idle: false, near: false })).toBe(false);
    expect(shouldRevealCalendar({ loaded: true, idle: false, near: true })).toBe(false);
    expect(shouldRevealCalendar({ loaded: true, idle: true, near: false })).toBe(false);
    expect(shouldRevealCalendar({ loaded: false, idle: true, near: true })).toBe(false);
    expect(shouldRevealCalendar({ loaded: true, idle: true, near: true })).toBe(true);
  });
});

describe("isNearViewport", () => {
  it("treats a missing IntersectionObserver as near", () => {
    expect(isNearViewport(false, false)).toBe(true);
  });
  it("otherwise follows the observer", () => {
    expect(isNearViewport(true, false)).toBe(false);
    expect(isNearViewport(true, true)).toBe(true);
  });
});

describe("constants", () => {
  it("match the spec", () => {
    expect(NEAR_ROOT_MARGIN).toBe("800px 0px");
    expect(IDLE_FALLBACK_MS).toBe(200);
  });
});
