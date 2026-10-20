import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { phoneWordLayout, VideoMaskHero } from "@/components/ui/VideoMaskHero";

describe("phoneWordLayout", () => {
  it("puts one word per line, centred vertically on the 1920-tall canvas", () => {
    expect(phoneWordLayout(["SELL", "WITH US"])).toEqual([
      { word: "SELL", y: 700 },
      { word: "WITH", y: 960 },
      { word: "US", y: 1220 },
    ]);
  });

  it("centres a single word", () => {
    expect(phoneWordLayout(["PRESS"])).toEqual([{ word: "PRESS", y: 960 }]);
  });

  it("ignores extra spaces", () => {
    expect(phoneWordLayout(["MANAGE", " WITH  US "]).map((w) => w.word)).toEqual(["MANAGE", "WITH", "US"]);
  });
});

function render(props: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(VideoMaskHero, { maskId: "t-mask", videoSrc: "/videos/t.mp4", lines: ["BUY", "WITH US"], ...props }),
  );
}

describe("VideoMaskHero heading", () => {
  it("renders one screen-reader-only h1 as the section's first child", () => {
    const html = render({ heading: "Buy a Home With CnC Realty" });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="sr-only">Buy a Home With CnC Realty</h1>');
    expect(html).toMatch(/^<section[^>]*><h1 class="sr-only">/);
  });

  it("renders no h1 when heading is not given", () => {
    expect(render({})).not.toContain("<h1");
  });

  it("hides every lettering svg from assistive tech", () => {
    const html = render({ heading: "x" });
    const svgs = (html.match(/<svg[^>]*>/g) ?? []).filter((t) => t.includes("preserveAspectRatio"));
    expect(svgs).toHaveLength(2);
    for (const tag of svgs) expect(tag).toContain('aria-hidden="true"');
  });
});
