import { describe, expect, it } from "vitest";
import { phoneSectionHeight, phoneTravelPx } from "@/lib/sell-process-scroll";

describe("phoneTravelPx", () => {
  it("is how far the row must slide so its right edge meets the screen's right edge", () => {
    expect(phoneTravelPx(3000, 390)).toBe(2610);
  });
  it("rounds to whole pixels", () => {
    expect(phoneTravelPx(3000.6, 390)).toBe(2611);
  });
  it("never goes negative when the row is narrower than the screen", () => {
    expect(phoneTravelPx(300, 390)).toBe(0);
  });
});

describe("phoneSectionHeight", () => {
  it("is the travel plus one screen height, so one swipe moves the cards about one-for-one", () => {
    expect(phoneSectionHeight(2610)).toBe("calc(2610px + 100svh)");
  });
  it("falls back to 600svh before the row has been measured", () => {
    expect(phoneSectionHeight(null)).toBe("600svh");
  });
});
