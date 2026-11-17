import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JoinClosing } from "@/components/join/JoinClosing";

// Ryan (2026-11-17): the calendar's floating shadow reaches ~120px below the card but its
// section leaves 96px. The final CTA section is positioned, so if it had its own background
// it would paint over the shadow's tail and leave a hard line. Instead, both sections share
// one off-white wrapper and the CTA section has no background, so the shadow fades into it.
describe("JoinClosing", () => {
  const html = renderToStaticMarkup(createElement(JoinClosing));

  it("wraps the calendar and the final CTA in one off-white background", () => {
    expect(html).toMatch(/^<div class="[^"]*bg-\[#F2F0EF\]/);
    expect(html).toContain('id="book-a-call"');
    expect(html).toContain("Your Journey Begins");
    expect(html.indexOf('id="book-a-call"')).toBeLessThan(html.indexOf("Your Journey Begins"));
  });

  it("gives the final CTA section no background of its own (so it can't cut the shadow off)", () => {
    const sections = html.match(/<section[^>]*>/g) ?? [];
    const cta = sections.find((s) => !s.includes('id="book-a-call"')) ?? "";
    expect(cta).not.toBe("");
    expect(cta).not.toMatch(/\bbg-/);
  });
});
