import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarHeader, CalendarSkeleton } from "@/components/booking/CalendarFrame";

// Ryan (2026-11-17): the calendar heading is "Meet with" over a gold "RYAN" (styled like the
// Buy page's "One stop / SHOP" title, RYAN sitting under "with"), centered, with no subtitle
// (Ryan dropped "by phone or Google Meet": visitors pick that in the booking steps).
// It lives in the shared CalendarHeader so every calendar placement matches.
describe("CalendarHeader", () => {
  const html = renderToStaticMarkup(createElement(CalendarHeader));
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("says just Meet with RYAN: no subtitle, no old wording", () => {
    expect(text.trim()).toBe("Meet with RYAN");
    expect(html).not.toContain("<p");
    expect(html).not.toContain("Google Meet");
    expect(html).not.toContain("Chat with");
    expect(html).not.toContain("Phone call");
  });

  it("puts RYAN on its own line, in the column under “with”, gold and medium weight", () => {
    const ryan = html.match(/<span[^>]*>RYAN<\/span>/)?.[0] ?? "";
    expect(ryan).toContain("col-start-2");
    expect(ryan).toContain("text-cnc-gold");
    expect(ryan).toContain("font-medium");
    const withWord = html.match(/<span[^>]*>with<\/span>/)?.[0] ?? "";
    expect(withWord).toContain("col-start-2");
  });

  it("centers the heading block", () => {
    expect(html).toMatch(/<h2[^>]*mx-auto/);
  });
});

describe("CalendarSkeleton", () => {
  it("shows the same real heading while loading, so nothing shifts when the calendar arrives", () => {
    const html = renderToStaticMarkup(createElement(CalendarSkeleton));
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("Meet with RYAN");
    expect(html).not.toContain("Google Meet");
  });
});
