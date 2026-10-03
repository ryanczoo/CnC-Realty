import { describe, it, expect } from "vitest";
import { ctaImageSize } from "@/components/home/JoinCnCCTA";

const num = (s: string) => parseFloat(s);

describe("ctaImageSize", () => {
  // Desktop must equal the old useTransform(progress, [0.1, 0.88], ["52%","100%"] / ["42vh","65vh"]).
  it("desktop: 52%×42vh before the range, 100%×65vh after (clamped)", () => {
    expect(ctaImageSize(0, false)).toEqual({ width: "52%", height: "42vh" });
    expect(ctaImageSize(0.95, false)).toEqual({ width: "100%", height: "65vh" });
  });

  it("desktop: halfway through the range", () => {
    const s = ctaImageSize(0.49, false);
    expect(num(s.width)).toBeCloseTo(76);
    expect(s.width.endsWith("%")).toBe(true);
    expect(num(s.height)).toBeCloseTo(53.5);
    expect(s.height.endsWith("vh")).toBe(true);
  });

  it("phone: starts larger (80% × 30svh) and ends full (100% × 65svh)", () => {
    expect(ctaImageSize(0, true)).toEqual({ width: "80%", height: "30svh" });
    expect(ctaImageSize(1, true)).toEqual({ width: "100%", height: "65svh" });
  });
});
