import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Server-render the portal in place so its markup can be read.
(globalThis as any).document = { body: {} };
vi.mock("react-dom", async (orig) => ({ ...(await orig<typeof import("react-dom")>()), createPortal: (n: unknown) => n }));
// PhotoGallery's first useState is the open photo's index: start it at photo 2
// so the gallery renders with its full-size view open.
vi.mock("react", async (orig) => {
  const R = await orig<typeof import("react")>();
  let first = true;
  return { ...R, useState: (init: unknown) => { if (first) { first = false; return R.useState(1 as unknown); } return R.useState(init); } };
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import { PhotoGallery } from "@/components/properties/PhotoGallery";

const lightbox = (photos: string[]) =>
  renderToStaticMarkup(
    createElement(PhotoLightbox, { photos, index: 0, alt: (i: number) => `photo ${i + 1}`, onIndexChange: vi.fn(), onClose: vi.fn() }),
  );

describe("PhotoLightbox", () => {
  it("matches the gallery's full-size view markup", () => {
    const before = readFileSync(join(__dirname, "fixtures/photo-gallery-lightbox-before.html"), "utf8");
    const html = renderToStaticMarkup(
      createElement(PhotoGallery, { photos: ["https://p/1.jpg", "https://p/2.jpg", "https://p/3.jpg"], address: "1 Main St" }),
    );
    expect(html).toBe(before);
  });

  it("hides the counter and arrows for a single photo", () => {
    const html = lightbox(["https://p/1.jpg"]);
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toContain(" / ");
    expect(html).not.toContain("Previous photo");
    expect(html).not.toContain("Next photo");
  });

  it("shows the counter and arrows for several photos", () => {
    const html = lightbox(["https://p/1.jpg", "https://p/2.jpg"]);
    expect(html).toContain("1 / 2");
    expect(html).toContain('aria-label="Next photo"');
  });
});
