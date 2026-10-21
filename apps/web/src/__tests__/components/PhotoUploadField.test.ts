import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoUploadField } from "@/components/transactions/PhotoUploadField";

const render = (photoKey: string) => renderToStaticMarkup(createElement(PhotoUploadField, { photoKey, onChange: vi.fn() }));

describe("PhotoUploadField", () => {
  it("renders the transaction wizard's existing markup with no photo", () => {
    expect(render("")).toBe(
      '<div class="text-center"><label class="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Property Photo</label>' +
        '<label class="inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-xs font-medium transition-colors bg-[#1B1B1B] text-white hover:bg-[#1B1B1B]/80">' +
        'Upload Photo<input type="file" accept="image/jpeg,image/png" class="sr-only"/></label></div>',
    );
  });

  it("offers Replace Photo and shows Photo uploaded with a check once a photo is set", () => {
    const html = render("wizard-photos/u1/a/photo.jpg");
    expect(html).toContain("Replace Photo");
    expect(html).toContain("Photo uploaded");
    expect(html).toContain("M7 12.9");
  });

  it("accepts only JPG and PNG", () => {
    expect(render("")).toContain('accept="image/jpeg,image/png"');
  });

  it("never pulses", () => {
    expect(render("")).not.toContain("transform");
  });
});
