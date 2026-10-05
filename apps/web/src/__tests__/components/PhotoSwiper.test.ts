import { describe, it, expect } from "vitest";
import { swiperIndex } from "@/components/properties/PhotoSwiper";

describe("swiperIndex", () => {
  it("maps the strip's scroll position to the photo in view", () => {
    expect(swiperIndex(0, 390, 5)).toBe(0);
    expect(swiperIndex(390, 390, 5)).toBe(1);
    expect(swiperIndex(800, 390, 5)).toBe(2); // mid-swipe rounds to nearest
  });
  it("clamps to the first/last photo and survives a zero width", () => {
    expect(swiperIndex(-20, 390, 5)).toBe(0);
    expect(swiperIndex(99999, 390, 5)).toBe(4);
    expect(swiperIndex(390, 0, 5)).toBe(0);
  });
});

import { scrollBehaviorFor } from "@/components/properties/PhotoSwiper";

describe("scrollBehaviorFor", () => {
  it("animates a one-photo step", () => {
    expect(scrollBehaviorFor(0, 1)).toBe("smooth");
    expect(scrollBehaviorFor(5, 4)).toBe("smooth");
  });
  it("jumps on wrap-around so it doesn't scroll past (and load) every photo", () => {
    expect(scrollBehaviorFor(0, 24)).toBe("instant");
    expect(scrollBehaviorFor(24, 0)).toBe("instant");
  });
});
