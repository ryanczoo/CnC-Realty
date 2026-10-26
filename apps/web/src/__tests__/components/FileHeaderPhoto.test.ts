import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FileHeaderPhoto } from "@/components/transactions/FileHeaderPhoto";

const render = (photoKey: string | null) =>
  renderToStaticMarkup(createElement(FileHeaderPhoto, { fileType: "listing", fileId: "l1", photoKey, address: "11538 Foster Road" }));

describe("FileHeaderPhoto", () => {
  it("renders nothing without a photo", () => {
    expect(render(null)).toBe("");
  });

  it("shows the photo from the file photo route, sized to the address lines and status row (smaller on phones)", () => {
    const html = render("wizard-photos/u1/x/photo.jpg");
    expect(html).toContain('src="/api/files/listing/l1/photo"');
    expect(html).toContain('alt="11538 Foster Road"');
    expect(html).toContain("h-20 w-[120px] rounded-lg object-cover max-sm:h-14 max-sm:w-[84px]");
    expect(html).toContain('aria-label="View full-size photo"');
  });
});
