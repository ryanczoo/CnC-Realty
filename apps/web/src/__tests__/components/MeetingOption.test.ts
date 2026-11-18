import { describe, it, expect } from "vitest";
import { meetingOptionCls } from "@/components/booking/BookingModal";
import { CTA_MESSAGE_CLS, WHITE_PILL_COLORS } from "@/components/ui/cta-styles";

const classes = (s: string) => s.split(/\s+/).filter(Boolean);

// Ryan (2026-11-17): in the booking pop-up, the unselected "How should we meet?" option
// (e.g. "Phone call") is a white button with black text and a solid black outline, the same
// shared look as the site's white "Message" CTA buttons, so it stands out on the white pop-up.
describe("meetingOptionCls", () => {
  it("unselected option uses the shared white pill colors (solid black outline, black text)", () => {
    const cls = classes(meetingOptionCls(false));
    for (const c of classes(WHITE_PILL_COLORS)) expect(cls).toContain(c);
    expect(cls.some((c) => c.includes("/15"))).toBe(false);
  });

  it("selected option stays solid black with white text", () => {
    const cls = classes(meetingOptionCls(true));
    expect(cls).toContain("bg-[#1B1B1B]");
    expect(cls).toContain("text-white");
    expect(cls).not.toContain("bg-white");
  });

  it("both states have the same outline and weight, so toggling doesn't change their size", () => {
    for (const active of [true, false]) {
      const cls = classes(meetingOptionCls(active));
      expect(cls).toContain("border");
      expect(cls).toContain("border-[#1B1B1B]");
      expect(cls).toContain("font-medium");
    }
  });
});

describe("WHITE_PILL_COLORS", () => {
  it("is the color set the white Message CTA button is built from", () => {
    for (const c of classes(WHITE_PILL_COLORS)) expect(classes(CTA_MESSAGE_CLS)).toContain(c);
  });
});
