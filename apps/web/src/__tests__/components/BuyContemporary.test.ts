import { describe, it, expect } from "vitest";
import { clusterGeometry } from "@/components/buy/BuyContemporary";

describe("clusterGeometry", () => {
  // Desktop must equal the original (K - C) offsets and SC scale ratios.
  it("desktop: unchanged offsets and scales", () => {
    const g = clusterGeometry(false);
    expect(g.ctr.dx).toBeCloseTo(0.3905, 4);   expect(g.ctr.dy).toBeCloseTo(0.1875, 4);   expect(g.ctr.scale).toBeCloseTo(1.42237, 4);
    expect(g.lft.dx).toBeCloseTo(0.2010, 4);   expect(g.lft.dy).toBeCloseTo(-0.32785, 4); expect(g.lft.scale).toBeCloseTo(1.10171, 4);
    expect(g.rgt.dx).toBeCloseTo(-0.13409, 4); expect(g.rgt.dy).toBeCloseTo(0.21215, 4);  expect(g.rgt.scale).toBeCloseTo(0.97711, 4);
    expect(g.bck.dx).toBeCloseTo(-0.3694, 4);  expect(g.bck.dy).toBeCloseTo(-0.29, 4);    expect(g.bck.scale).toBeCloseTo(1.31255, 4);
  });

  it("portrait phone: two-by-two corners gathering into a larger centred cluster", () => {
    const g = clusterGeometry(true);
    expect(g.ctr).toEqual({ dx: expect.closeTo(0.23, 4), dy: expect.closeTo(0.3, 4), scale: expect.closeTo(1.55, 4) });
    expect(g.lft).toEqual({ dx: expect.closeTo(0.03, 4), dy: expect.closeTo(-0.27, 4), scale: expect.closeTo(1.1, 4) });
    expect(g.rgt).toEqual({ dx: expect.closeTo(-0.03, 4), dy: expect.closeTo(0.23, 4), scale: expect.closeTo(1.1, 4) });
    expect(g.bck).toEqual({ dx: expect.closeTo(-0.23, 4), dy: expect.closeTo(-0.32, 4), scale: expect.closeTo(1.55, 4) });
  });
});
