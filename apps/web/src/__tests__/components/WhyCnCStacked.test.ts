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
  it("phones use the measured card height when known (Safari's bar makes innerHeight differ from CSS vh)", () => {
    expect(stackGeometry(664, "portrait", 390)).toEqual({ offset: 40, cardH: 390 });
    expect(stackGeometry(340, "landscape", 180)).toEqual({ offset: 40, cardH: 180 });
  });
  it("desktop ignores a measured height (unchanged 52vh)", () => {
    expect(stackGeometry(900, "desktop", 500)).toEqual({ offset: 88, cardH: 468 });
  });
});
