import { describe, it, expect } from "vitest";
import * as bundle from "@/lib/dashboard-phone";

describe("dashboard phone bundle", () => {
  it("exports the twelve phone bundles", () => {
    expect(Object.keys(bundle).sort()).toEqual([
      "PHONE_DRAG_CARD", "PHONE_DRAG_PLACEHOLDER", "PHONE_DRAWER_PANEL", "PHONE_FIELDS_16", "PHONE_FIELD_PAIR", "PHONE_HEADER_ACTIONS",
      "PHONE_HEADER_STACK", "PHONE_POPUP_FRAME", "PHONE_POPUP_PANEL", "PHONE_TABLE_FRAME", "PHONE_TAB_BAR",
      "PHONE_WRAP_TEXT",
    ]);
  });

  it("wrap text lets a truncated line wrap on phones (overrides truncate's nowrap, breaks long words)", () => {
    expect(bundle.PHONE_WRAP_TEXT.split(/\s+/)).toEqual(["max-lg:whitespace-normal", "max-lg:[overflow-wrap:anywhere]"]);
  });

  it("every class word is phone-only (below 1024px or below 640px), so nothing here can reach desktop", () => {
    for (const [name, value] of Object.entries(bundle)) {
      expect(typeof value, name).toBe("string");
      const words = (value as string).split(/\s+/).filter(Boolean);
      expect(words.length, name).toBeGreaterThan(0);
      for (const word of words) expect(word, `${name}: ${word}`).toMatch(/^max-(lg|sm):/);
    }
  });

  it("the spot a picked-up card left shows a faded gold dashed outline on phones", () => {
    expect(bundle.PHONE_DRAG_PLACEHOLDER.split(/\s+/)).toEqual(["max-lg:outline-dashed", "max-lg:outline-2", "max-lg:outline-[#c9a84c]/60"]);
  });

  it("drag cards carry the -webkit- prefixed user-select (iOS Safari ignores the unprefixed one)", () => {
    expect(bundle.PHONE_DRAG_CARD.split(/\s+/)).toContain("max-lg:[-webkit-user-select:none]");
  });

  it("header actions make the status select full width too (it sits inside a wrapper div)", () => {
    expect(bundle.PHONE_HEADER_ACTIONS.split(/\s+/)).toContain("max-lg:[&_select]:w-full");
  });

  it("header actions make the Tooltip-wrapped Convert button full width too (button sits inside div.group)", () => {
    expect(bundle.PHONE_HEADER_ACTIONS.split(/\s+/)).toContain("max-lg:[&>.group>button]:w-full");
  });
});
