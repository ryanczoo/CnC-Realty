import { describe, it, expect } from "vitest";
import { boardSensorKinds, DESKTOP_DRAG, PHONE_TOUCH_DRAG, isTouchHold, liftBuzz } from "@/hooks/useBoardSensors";

describe("board drag sensors", () => {
  it("desktop keeps today's mouse drag exactly", () => {
    expect(boardSensorKinds(false)).toEqual(["pointer"]);
    expect(DESKTOP_DRAG).toEqual({ distance: 8 });
  });
  it("phones pick a card up after a 0.4s hold, so swipes still scroll", () => {
    expect(boardSensorKinds(true)).toEqual(["touch", "mouse"]);
    expect(PHONE_TOUCH_DRAG).toEqual({ delay: 400, tolerance: 8 });
  });
  it("only a drag started by the phone touch hold counts as a lift (desktop mouse/pointer drags don't)", () => {
    expect(isTouchHold(new Event("touchstart"))).toBe(true);
    expect(isTouchHold(new Event("pointerdown"))).toBe(false);
    expect(isTouchHold(new Event("mousedown"))).toBe(false);
    expect(isTouchHold(null)).toBe(false);
  });
  it("pick-up buzz is one short vibration where the phone allows it, and a no-op where it doesn't (iPhone)", () => {
    const calls: number[] = [];
    liftBuzz({ vibrate: (ms: number) => { calls.push(ms); return true; } });
    expect(calls).toEqual([15]);
    expect(() => liftBuzz({})).not.toThrow();
    expect(() => liftBuzz(undefined)).not.toThrow();
  });
});
