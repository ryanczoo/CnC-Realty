import { describe, it, expect } from "vitest";
import { getStackDepth } from "@/components/home/AdvantageCarousel";

describe("getStackDepth", () => {
  it("marks the active index as front", () => {
    expect(getStackDepth(1, 1, 3)).toBe("front");
  });

  it("marks the next index as middle", () => {
    expect(getStackDepth(2, 1, 3)).toBe("middle");
  });

  it("marks the index after that as back", () => {
    expect(getStackDepth(0, 1, 3)).toBe("back");
  });

  it("computes correctly when active index is 0", () => {
    expect(getStackDepth(0, 0, 3)).toBe("front");
    expect(getStackDepth(1, 0, 3)).toBe("middle");
    expect(getStackDepth(2, 0, 3)).toBe("back");
  });

  it("wraps around: middle wraps past the end back to index 0", () => {
    expect(getStackDepth(0, 2, 3)).toBe("middle");
  });
});
