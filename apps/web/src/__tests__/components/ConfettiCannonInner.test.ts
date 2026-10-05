import { describe, it, expect } from "vitest";
import { confettiCanvasSize } from "@/components/join/ConfettiCannonInner";

describe("confettiCanvasSize", () => {
  it("desktop keys at the video's native 1280x720 (unchanged)", () => {
    expect(confettiCanvasSize(false)).toEqual({ width: 1280, height: 720 });
  });
  it("phones key at half resolution — 4x fewer pixels per frame", () => {
    expect(confettiCanvasSize(true)).toEqual({ width: 640, height: 360 });
  });
});
