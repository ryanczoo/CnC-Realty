import { describe, it, expect } from "vitest";
import { applyChromaKeyAlpha } from "@/lib/chroma-key-alpha";

function pixel(data: Uint8ClampedArray, i: number) {
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

describe("applyChromaKeyAlpha", () => {
  it("makes the exact key color fully transparent", () => {
    const data = new Uint8ClampedArray([119, 253, 154, 255]);
    applyChromaKeyAlpha(data);
    expect(pixel(data, 0).a).toBe(0);
  });

  it("keeps a real confetti color fully opaque", () => {
    // measured gold confetti pixel, ~120 units from the key color
    const data = new Uint8ClampedArray([235, 227, 134, 255]);
    applyChromaKeyAlpha(data);
    expect(pixel(data, 0).a).toBe(255);
  });

  it("keeps a dark, olive-toned confetti shadow fully opaque despite being closer to green", () => {
    // the most green-adjacent real sample measured, still ~148 units away
    const data = new Uint8ClampedArray([104, 138, 62, 255]);
    applyChromaKeyAlpha(data);
    expect(pixel(data, 0).a).toBe(255);
  });

  it("gives a mid-distance edge pixel a partial, non-binary alpha", () => {
    // constructed to sit inside the transition band, not at either extreme
    const data = new Uint8ClampedArray([119, 200, 154, 255]);
    applyChromaKeyAlpha(data);
    const a = pixel(data, 0).a;
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
  });

  it("preserves RGB on fully opaque pixels", () => {
    const data = new Uint8ClampedArray([235, 227, 134, 255]);
    applyChromaKeyAlpha(data);
    const p = pixel(data, 0);
    expect(p.r).toBe(235);
    expect(p.g).toBe(227);
    expect(p.b).toBe(134);
  });

  it("suppresses green spill by clamping the green channel on partially-transparent edge pixels", () => {
    // a spill pixel ~42 units from the key color (inside the transition
    // band), with green elevated above red/blue
    const data = new Uint8ClampedArray([110, 220, 130, 255]);
    applyChromaKeyAlpha(data);
    const p = pixel(data, 0);
    expect(p.a).toBeGreaterThan(0);
    expect(p.a).toBeLessThan(255);
    expect(p.g).toBeLessThanOrEqual(Math.max(p.r, p.b));
  });

  it("does not spill-correct an opaque pixel with no green elevation", () => {
    const data = new Uint8ClampedArray([235, 227, 134, 255]); // real gold confetti, g isn't elevated
    applyChromaKeyAlpha(data);
    const p = pixel(data, 0);
    expect(p.g).toBe(227); // untouched
  });

  it("spill-corrects a fully opaque pixel that still carries green contamination", () => {
    // motion-blurred confetti edges can land far enough from the key color
    // to read as fully opaque while still carrying real green contamination
    // baked into the source footage -- spill suppression must not be
    // limited to the narrow partial-alpha transition band
    const data = new Uint8ClampedArray([120, 200, 90, 255]);
    applyChromaKeyAlpha(data);
    const p = pixel(data, 0);
    expect(p.a).toBe(255);
    expect(p.g).toBeLessThanOrEqual(Math.max(p.r, p.b));
  });

  it("processes every pixel in a multi-pixel buffer independently", () => {
    const data = new Uint8ClampedArray([
      119, 253, 154, 255, // exact key color -> transparent
      235, 227, 134, 255, // real confetti -> opaque
    ]);
    applyChromaKeyAlpha(data);
    expect(pixel(data, 0).a).toBe(0);
    expect(pixel(data, 4).a).toBe(255);
  });
});
