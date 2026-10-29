import { describe, it, expect } from "vitest";
import { pillScrollLeft } from "@/lib/pill-scroll";

const view = { left: 0, width: 390, scrollLeft: 100 };

describe("pillScrollLeft", () => {
  it("leaves a fully visible pill alone", () => {
    expect(pillScrollLeft(view, { left: 50, width: 80 })).toBeNull();
  });
  it("scrolls right so a pill off the right edge sits 16px from it", () => {
    // pill spans 420..520 on screen; right edge must land at 390 - 16 = 374 → scroll by 146
    expect(pillScrollLeft(view, { left: 420, width: 100 })).toBe(246);
  });
  it("scrolls left so a pill off the left edge sits 16px from it", () => {
    // pill starts at -40 on screen; must land at 16 → scroll back by 56
    expect(pillScrollLeft(view, { left: -40, width: 80 })).toBe(44);
  });
});

import { readFileSync } from "fs";
import path from "path";
const src = (p: string) => readFileSync(path.join(__dirname, "../..", p), "utf8");

describe("phone fixes wired in", () => {
  it("custom-list edit/delete buttons are 44px on phones", () => {
    const s = src("components/leads/SmartListSidebar.tsx");
    expect(s.match(/max-lg:min-h-11 max-lg:min-w-11/g)?.length).toBe(2);
  });
  it("the Leads page scrolls the chosen pill into view", () => {
    expect(src("components/leads/SmartListSidebar.tsx")).toContain("pillScrollLeft(");
  });
  it("both lead-name lines on the Tasks page wrap on phones", () => {
    const s = src("app/(dashboard)/dashboard/tasks/page.tsx");
    expect(s).toContain('<p className={`text-xs text-[#1B1B1B]/40 ${PHONE_WRAP_TEXT}`}>');
    expect(s).toContain('<p className={`text-xs text-[#1B1B1B]/30 ${PHONE_WRAP_TEXT}`}>');
  });
});
