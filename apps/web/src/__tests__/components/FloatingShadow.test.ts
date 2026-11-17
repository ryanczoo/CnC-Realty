import { describe, it, expect } from "vitest";
import tailwindConfig from "../../../tailwind.config";
import { CARD_CLS } from "@/components/booking/CalendarFrame";

// Ryan (2026-11-17): the booking calendar gets the same floating shadow as the homepage
// "See the difference, with CnC" cards. One shared token, used by both.
const HOMEPAGE_CARD_SHADOW =
  "0 40px 80px rgba(0,0,0,0.32), 0 16px 32px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.12)";

describe("shadow-floating", () => {
  it("is defined once in the Tailwind theme with the homepage card value", () => {
    const extend = tailwindConfig.theme?.extend as { boxShadow?: Record<string, string> };
    expect(extend.boxShadow?.floating).toBe(HOMEPAGE_CARD_SHADOW);
  });

  it("is on the shared calendar card (every calendar state and page uses CARD_CLS)", () => {
    const classes = CARD_CLS.split(/\s+/);
    expect(classes).toContain("shadow-floating");
    expect(classes).not.toContain("shadow-sm");
  });
});
