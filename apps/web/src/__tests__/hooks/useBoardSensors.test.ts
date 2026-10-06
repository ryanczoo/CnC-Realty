import { describe, it, expect } from "vitest";
import { boardSensorKinds, DESKTOP_DRAG, PHONE_TOUCH_DRAG } from "@/hooks/useBoardSensors";

describe("board drag sensors", () => {
  it("desktop keeps today's mouse drag exactly", () => {
    expect(boardSensorKinds(false)).toEqual(["pointer"]);
    expect(DESKTOP_DRAG).toEqual({ distance: 8 });
  });
  it("phones pick a card up after a 0.4s hold, so swipes still scroll", () => {
    expect(boardSensorKinds(true)).toEqual(["touch", "mouse"]);
    expect(PHONE_TOUCH_DRAG).toEqual({ delay: 400, tolerance: 8 });
  });
});
