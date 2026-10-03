import { describe, it, expect } from "vitest";
import { cardVars } from "@/components/sell/SellValues";

describe("cardVars", () => {
  it("desktop: centres card 2 at the midpoint of the scroll (unchanged numbers)", () => {
    const v = cardVars(2, 0.5, false, 900);
    expect(v.x).toBeCloseTo(-150);
    expect(v.y).toBeCloseTo(-60);
    expect(v.scale).toBeCloseTo(1);
    expect(v.opacity).toBeCloseTo(1);
    expect(v.rotate).toBeCloseTo(0);
  });

  it("desktop: puts card 4 far to the side at the start (unchanged numbers)", () => {
    const v = cardVars(4, 0, false, 900);
    expect(v.x).toBeCloseTo(421.58, 1);
    expect(v.y).toBeCloseTo(-1050);
    expect(v.scale).toBeCloseTo(0.64);
    expect(v.opacity).toBeCloseTo(0.42);
    expect(v.rotate).toBeCloseTo(50.4);
  });

  it("phone: uses the smaller arch and card size", () => {
    const v = cardVars(2, 0.5, true, 900);
    expect(v.x).toBeCloseTo(-80);
    expect(v.y).toBeCloseTo(31);
  });
});
