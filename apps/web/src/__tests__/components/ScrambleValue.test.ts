import { describe, it, expect } from "vitest";
import { countDigits, lockedDigitCount, scrambleSequential } from "@/components/ui/ScrambleValue";

describe("countDigits", () => {
  it("counts digit characters, ignoring punctuation", () => {
    expect(countDigits("12,924+")).toBe(5);
  });

  it("handles a single digit", () => {
    expect(countDigits("$0")).toBe(1);
  });

  it("counts across multiple separators", () => {
    expect(countDigits("24/7")).toBe(3);
  });
});

describe("lockedDigitCount", () => {
  it("locks nothing before the settle step begins", () => {
    expect(lockedDigitCount(5, 30, 22, 5)).toBe(0);
    expect(lockedDigitCount(22, 30, 22, 5)).toBe(0);
  });

  it("locks all digits once totalSteps is reached or passed", () => {
    expect(lockedDigitCount(30, 30, 22, 5)).toBe(5);
    expect(lockedDigitCount(40, 30, 22, 5)).toBe(5);
  });

  it("locks digits left-to-right proportionally through the settle window", () => {
    // window is steps 22->30 (8 steps), totalDigits=5; halfway through -> 2 locked
    expect(lockedDigitCount(26, 30, 22, 5)).toBe(2);
  });

  it("never decreases as step increases", () => {
    const counts = [22, 23, 24, 25, 26, 27, 28, 29, 30].map((step) =>
      lockedDigitCount(step, 30, 22, 5)
    );
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });
});

describe("scrambleSequential", () => {
  it("returns the exact value once every digit is locked", () => {
    expect(scrambleSequential("12,924+", 5)).toBe("12,924+");
  });

  it("still returns the exact value when lockedCount exceeds the digit count", () => {
    expect(scrambleSequential("12,924+", 99)).toBe("12,924+");
  });

  it("locks only the leftmost N digit positions, randomizing the rest", () => {
    const result = scrambleSequential("12,924+", 2);
    expect(result.slice(0, 2)).toBe("12");
    expect(result).toMatch(/^12,[0-9]{3}\+$/);
  });

  it("preserves non-digit characters and randomizes every digit when nothing is locked", () => {
    const result = scrambleSequential("12,924+", 0);
    expect(result).toMatch(/^[0-9]{2},[0-9]{3}\+$/);
  });
});
