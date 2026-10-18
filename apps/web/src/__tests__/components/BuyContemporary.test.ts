import { describe, it, expect } from "vitest";
import { clusterGeometry, phoneProgress, phoneLinePaths } from "@/components/buy/BuyContemporary";

// "M x,y Q cx,cy ex,ey" → numbers
const parse = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe("phoneLinePaths", () => {
  // Upright phones: each line starts where the photo-centre→logo line leaves
  // the photo, and ends at the logo centre — measured from the real layout.
  const logo = { x: 195, y: 420 };
  const boxes = [
    { x: 27, y: 76, w: 156, h: 186 },   // top-left photo
    { x: 207, y: 127, w: 156, h: 186 }, // top-right photo
    { x: 27, y: 550, w: 156, h: 186 },  // bottom-left photo
    { x: 207, y: 601, w: 156, h: 186 }, // bottom-right photo
  ];

  it("one curve per photo, each ending at the logo centre", () => {
    const paths = phoneLinePaths(boxes, logo);
    expect(paths).toHaveLength(4);
    for (const d of paths) {
      expect(d).toMatch(/^M [\d.-]+,[\d.-]+ Q [\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+$/);
      const n = parse(d);
      expect(n[4]).toBeCloseTo(195, 0);
      expect(n[5]).toBeCloseTo(420, 0);
    }
  });

  it("starts on the photo's edge facing the logo", () => {
    const [tl, tr, bl] = phoneLinePaths(boxes, logo).map(parse);
    expect(tl[1]).toBeCloseTo(76 + 186, 0);   // top-left: leaves through its bottom edge
    expect(tr[1]).toBeCloseTo(127 + 186, 0);  // top-right: bottom edge
    expect(bl[1]).toBeCloseTo(550, 0);        // bottom-left: top edge
    expect(tl[0]).toBeGreaterThan(27);
    expect(tl[0]).toBeLessThan(27 + 156);
  });

  it("bows every curve the same way as desktop (clockwise of the chord)", () => {
    for (const [sx, sy, cx, cy, ex, ey] of phoneLinePaths(boxes, logo).map(parse)) {
      const dx = ex - sx, dy = ey - sy;
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      // control point sits on the (dy, -dx) side of the chord midpoint
      expect((cx - mx) * dy + (cy - my) * -dx).toBeGreaterThan(0);
    }
  });
});

describe("phoneProgress", () => {
  // The desktop timeline assumes the panel unpins at progress 0.75. On phones
  // the shorter section unpins earlier, so that moment is remapped to 0.75 and
  // the fly-in + hold finish while the panel is still pinned.
  it("maps the unpin moment to 0.75", () => {
    expect(phoneProgress(0.667, 0.667)).toBeCloseTo(0.75);
    expect(phoneProgress(0.63, 0.63)).toBeCloseTo(0.75);
  });
  it("starts at 0 and clamps at 1", () => {
    expect(phoneProgress(0, 0.667)).toBe(0);
    expect(phoneProgress(1, 0.667)).toBe(1);
  });
});

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

  // Read 12 times per scroll frame, so both layouts are worked out once, not per call.
  it("returns the same precomputed geometry on every call", () => {
    expect(clusterGeometry(false)).toBe(clusterGeometry(false));
    expect(clusterGeometry(true)).toBe(clusterGeometry(true));
  });
});
