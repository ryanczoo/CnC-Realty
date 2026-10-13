import { describe, it, expect } from "vitest";
import { CARD_LIFT_ANIMATE, CARD_LIFT_CLS, CARD_LIFT_PLACEHOLDER, SPRING_HOVER } from "@/lib/motion";

describe("board card lift (every drag — mouse or phone touch hold)", () => {
  it("pops the card up 5% and tilts it 2°", () => {
    expect(CARD_LIFT_ANIMATE).toEqual({ scale: 1.05, rotate: 2 });
  });
  it("styles the card itself (so the ring follows each card's own corners): deep shadow and a gold ring", () => {
    expect(CARD_LIFT_CLS.split(/\s+/)).toEqual([
      "[&>*]:shadow-2xl", "[&>*]:ring-2", "[&>*]:ring-[#c9a84c]",
    ]);
  });
  it("the spot the card was picked up from shows a faded gold dashed outline at every screen size", () => {
    expect(CARD_LIFT_PLACEHOLDER.split(/\s+/)).toEqual(["outline-dashed", "outline-2", "outline-[#c9a84c]/60"]);
  });
  it("reuses the shared hover spring", () => {
    expect(SPRING_HOVER).toEqual({ type: "spring", stiffness: 300, damping: 20 });
  });
});
