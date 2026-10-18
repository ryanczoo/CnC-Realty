import { describe, it, expect } from "vitest";
import { cardVars, SIDEWAYS_CARD_SCALE } from "@/components/sell/SellValues";

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

  // Sideways phones: cards shrink from their own centre so the top edge clears the
  // "Our Values" title; each card keeps its exact spot on the arc.
  it("sideways phone: every card is smaller, in the same place", () => {
    for (const [i, t] of [[2, 0.5], [1, 0.5], [3, 0.2], [0, 0.9]] as const) {
      const upright = cardVars(i, t, true, 390);
      const sideways = cardVars(i, t, true, 390, true);
      expect(sideways.x).toBeCloseTo(upright.x);
      expect(sideways.y).toBeCloseTo(upright.y);
      expect(sideways.rotate).toBeCloseTo(upright.rotate);
      expect(sideways.opacity).toBeCloseTo(upright.opacity);
      expect(sideways.scale).toBeCloseTo(upright.scale * SIDEWAYS_CARD_SCALE);
    }
    expect(SIDEWAYS_CARD_SCALE).toBeLessThan(1);
  });

  it("desktop ignores the sideways flag", () => {
    expect(cardVars(2, 0.5, false, 900, true)).toEqual(cardVars(2, 0.5, false, 900));
  });
});
