import { describe, it, expect } from "vitest";
import * as bundle from "@/lib/dashboard-phone";

describe("dashboard phone bundle", () => {
  it("exports the seven phone bundles", () => {
    expect(Object.keys(bundle).sort()).toEqual([
      "PHONE_DRAG_CARD", "PHONE_DRAWER_PANEL", "PHONE_FIELDS_16", "PHONE_POPUP_FRAME",
      "PHONE_POPUP_PANEL", "PHONE_TABLE", "PHONE_TAB_BAR",
    ]);
  });

  it("every class word is phone-only, so nothing here can reach desktop", () => {
    for (const [name, value] of Object.entries(bundle)) {
      expect(typeof value, name).toBe("string");
      const words = (value as string).split(/\s+/).filter(Boolean);
      expect(words.length, name).toBeGreaterThan(0);
      for (const word of words) expect(word, `${name}: ${word}`).toMatch(/^max-lg:/);
    }
  });
});
