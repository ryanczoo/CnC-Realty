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
