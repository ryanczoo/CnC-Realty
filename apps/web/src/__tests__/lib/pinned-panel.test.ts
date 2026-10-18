import { describe, it, expect } from "vitest";
import { pinnedPanelHeight } from "@/lib/pinned-panel";

// Pinned scroll sections size things off the panel's CSS height (100vh). On phones the
// visible window is shorter while the browser's address bar shows, so phones use the
// panel's own height (steady as the bar slides). Desktop keeps the window height exactly.
describe("pinnedPanelHeight", () => {
  it("desktop: the window height", () => {
    expect(pinnedPanelHeight(false, 900, 880)).toBe(880);
  });
  it("phone: the pinned panel's height", () => {
    expect(pinnedPanelHeight(true, 844, 764)).toBe(844);
  });
  it("phone, panel not measured yet: falls back to the window height", () => {
    expect(pinnedPanelHeight(true, 0, 764)).toBe(764);
  });
});
