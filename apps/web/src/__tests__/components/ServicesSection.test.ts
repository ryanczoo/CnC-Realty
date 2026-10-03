import { describe, it, expect } from "vitest";
import { parallaxY } from "@/components/home/ServicesSection";

describe("parallaxY", () => {
  // Desktop must equal the old useTransform(scrollYProgress, [0, 1], [p, -p]).
  it("desktop: moves from +p to -p across the scroll (unchanged)", () => {
    expect(parallaxY(200, 0, false)).toBeCloseTo(200);
    expect(parallaxY(200, 0.5, false)).toBeCloseTo(0);
    expect(parallaxY(200, 1, false)).toBeCloseTo(-200);
    expect(parallaxY(450, 0.25, false)).toBeCloseTo(225);
  });

  it("phone: uses 15% of the distance so stacked cards never collide", () => {
    expect(parallaxY(200, 0, true)).toBeCloseTo(30);
    expect(parallaxY(450, 1, true)).toBeCloseTo(-67.5);
  });

  it("the Buy card (parallax 0) never moves", () => {
    expect(parallaxY(0, 0.3, false)).toBeCloseTo(0);
    expect(parallaxY(0, 0.3, true)).toBeCloseTo(0);
  });
});
