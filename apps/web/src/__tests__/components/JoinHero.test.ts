import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JoinHero } from "@/components/join/JoinHero";

describe("JoinHero heading", () => {
  const html = renderToStaticMarkup(createElement(JoinHero));

  it("has exactly one screen-reader-only h1 with the en dash", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="sr-only">Be CnC – Join CnC Realty</h1>');
  });

  it("hides both lettering svgs from assistive tech", () => {
    const svgs = (html.match(/<svg[^>]*>/g) ?? []).filter((t) => t.includes("preserveAspectRatio"));
    expect(svgs).toHaveLength(2);
    for (const tag of svgs) expect(tag).toContain('aria-hidden="true"');
  });
});
