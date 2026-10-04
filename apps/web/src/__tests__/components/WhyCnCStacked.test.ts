import { describe, it, expect } from "vitest";
import { stackGeometry } from "@/components/join/WhyCnCStacked";

describe("stackGeometry", () => {
  it("desktop: 88px offset and 52vh cards (unchanged)", () => {
    expect(stackGeometry(900, "desktop")).toEqual({ offset: 88, cardH: 468 });
    expect(stackGeometry(800, "desktop")).toEqual({ offset: 88, cardH: 416 });
  });
  it("upright phones: tighter 40px offset, same 52vh cards", () => {
    expect(stackGeometry(844, "portrait")).toEqual({ offset: 40, cardH: expect.closeTo(438.88, 6) });
  });
  it("sideways phones: 40px offset and shorter 48vh cards so the last card ends on screen", () => {
    expect(stackGeometry(390, "landscape")).toEqual({ offset: 40, cardH: expect.closeTo(187.2, 6) });
  });
});
