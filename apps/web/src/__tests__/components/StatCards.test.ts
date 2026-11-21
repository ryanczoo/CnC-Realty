import { describe, it, expect } from "vitest";
import { STAT_GRID_CLS, STAT_CARD_CLS, isLongStatValue, STAT_VALUE_FIT_CLS, statValueFitCls } from "@/components/agents/StatCards";

// Ryan (2026-11-20): on phones the agent page's 4 stat cards were a sideways strip — only 1 card
// fit on screen and nobody would know to swipe for the rest (the strip also clipped the staggered
// cards' labels). Phones get 2 rows of 2; tablet/desktop keep the signed-off 4-across row.
const classes = (s: string) => s.split(/\s+/).filter(Boolean);

describe("agent StatCards layout", () => {
  it("is a 2-column grid on phones, with no sideways scrolling strip", () => {
    const grid = classes(STAT_GRID_CLS);
    expect(grid).toContain("grid");
    expect(grid).toContain("grid-cols-2");
    expect(grid).not.toContain("flex");
    expect(STAT_GRID_CLS).not.toMatch(/overflow-x-auto|scroll-snap/);
  });

  it("keeps the 4-across row from tablet width up", () => {
    expect(classes(STAT_GRID_CLS)).toContain("md:grid-cols-4");
  });

  it("cards fill their grid column instead of a fixed swipe width", () => {
    const card = classes(STAT_CARD_CLS);
    expect(STAT_CARD_CLS).not.toMatch(/min-w-\[200px\]|scroll-snap|flex-shrink-0/);
    expect(card).toContain("min-w-0");
  });

  it("keeps the desktop card look (square from tablet up, 3.2rem padding, rounded)", () => {
    const card = classes(STAT_CARD_CLS);
    expect(card).toEqual(expect.arrayContaining(["md:aspect-square", "md:p-[3.2rem]", "rounded-2xl"]));
  });

  it("gives all 4 phone cards the same height (a 2-line label must not make one card taller)", () => {
    // Square on phones let "Years of Experience" (2 lines) grow its card past its neighbour.
    expect(classes(STAT_CARD_CLS)).not.toContain("aspect-square");
    expect(classes(STAT_GRID_CLS)).toContain("auto-rows-fr");
  });
});

// Ryan (2026-11-20): 4-digit values (e.g. "$125.4M") must shrink to fit the card on small phones.
// The widest one ("$444.4M") is 129px at the normal 32px size; a 360px phone card has ~109px of room.
describe("agent StatCards long values", () => {
  it("treats a value with 4 or more digits as long", () => {
    expect(isLongStatValue("$125.4M")).toBe(true);
    expect(isLongStatValue("$1250M")).toBe(true);
    expect(isLongStatValue("1250")).toBe(true);
  });

  it("leaves values with 3 or fewer digits alone", () => {
    expect(isLongStatValue("$74.3M")).toBe(false);
    expect(isLongStatValue("12")).toBe(false);
    expect(isLongStatValue("—")).toBe(false);
  });

  it("shrinks only on phones (below md) and overrides the desktop inline size", () => {
    for (const v of ["$125.4M", "$74.3M", "7"]) {
      const cls = classes(statValueFitCls(v));
      expect(cls).toHaveLength(1);
      expect(cls[0]).toMatch(/^max-md:!text-\[clamp\(/);
    }
  });

  it("gives long values the stronger shrink", () => {
    expect(statValueFitCls("$125.4M")).toBe(STAT_VALUE_FIT_CLS);
  });

  // Ryan (2026-11-20): on the 320px-wide 2016 iPhone SE even "$74.3M" (104px) spills out of a
  // 90px card, and "$40.4M" (111px) spills 1px out of a 360px phone's 110px card.
  it("also fits shorter values on the narrowest phones, with a gentler shrink", () => {
    const short = statValueFitCls("$74.3M");
    expect(short).not.toBe(STAT_VALUE_FIT_CLS);
    expect(statValueFitCls("$40.4M")).toBe(short);
    expect(statValueFitCls("7")).toBe(short);
  });
});
