import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookACallSection } from "@/components/join/BookACallSection";
import { mergePrefill } from "@/components/booking/BookingModal";

describe("BookACallSection", () => {
  it("renders the anchored section; the calendar card's own heading is the only title", () => {
    const html = renderToStaticMarkup(createElement(BookACallSection));
    expect(html).toContain('id="book-a-call"');
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text.match(/Meet with RYAN/g)).toHaveLength(1);
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html).not.toContain("Chat with");
    expect(html).not.toContain("Pacific Time");
  });

  // The booking pop-up (fixed, z-50) renders inside this section. A z-index on the section
  // would make it a stacking context and trap the pop-up under the fixed navbar (z-50).
  it("has no z-index, so the booking pop-up can sit above the navbar", () => {
    const html = renderToStaticMarkup(createElement(BookACallSection));
    const section = html.match(/<section[^>]*id="book-a-call"[^>]*>/)?.[0] ?? "";
    const classes = section.match(/class="([^"]*)"/)?.[1].split(/\s+/) ?? [];
    expect(classes.some((c) => /^z-/.test(c))).toBe(false);
  });
});

describe("mergePrefill", () => {
  const empty = { firstName: "", lastName: "", email: "", phone: "", role: "", notes: "" };
  const pre = { firstName: "Ann", lastName: "Lee", email: "a@b.co" };
  it("fills empty fields", () => {
    expect(mergePrefill(empty, pre)).toMatchObject(pre);
  });
  it("keeps what the visitor already typed", () => {
    const f = { ...empty, firstName: "Annie", email: "x@y.co" };
    expect(mergePrefill(f, pre)).toMatchObject({ firstName: "Annie", lastName: "Lee", email: "x@y.co" });
  });
  it("is a no-op with no prefill", () => {
    expect(mergePrefill(empty, null)).toEqual(empty);
  });
});
