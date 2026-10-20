import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestimonialCards } from "@/components/home/TestimonialCards";

describe("TestimonialCards", () => {
  it("shows the white-house photo after Kevin's review on phones only", () => {
    const html = renderToStaticMarkup(createElement(TestimonialCards));
    const photoDiv = html.match(/<div[^>]*>(?=<img[^>]*testimonials-left)/)?.[0] ?? "";
    expect(photoDiv).toContain("max-lg:order-1");
    // Desktop source order is unchanged: the photo still comes first in the column.
    expect(html.indexOf("testimonials-left")).toBeLessThan(html.indexOf("Kevin Luevanos"));
  });
});
