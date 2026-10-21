import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UploadResultLine } from "@/components/ui/UploadResultLine";

const render = (props: Parameters<typeof UploadResultLine>[0]) =>
  renderToStaticMarkup(createElement(UploadResultLine, props));

describe("UploadResultLine", () => {
  it("renders nothing without a result", () => {
    expect(render({ result: null })).toBe("");
  });

  it("success shows the file name and the check icon in gold", () => {
    const html = render({ result: { name: "Pest.pdf", ok: true } });
    expect(html).toContain("Pest.pdf");
    expect(html).toContain("text-[#9E8C61]");
    expect(html).toContain("M7 12.9");
  });

  it("failure shows the label, the X icon and the server reason in red", () => {
    const html = render({
      label: "Photo uploaded",
      result: { name: "big.jpg", ok: false, error: "File exceeds 50MB limit" },
    });
    expect(html).toContain("Photo uploaded");
    expect(html).not.toContain("big.jpg");
    expect(html).toContain("M7 7L17 17");
    expect(html).toContain("File exceeds 50MB limit");
    expect(html).toContain("text-red-600");
  });

  it("center alignment wraps the line in text-center", () => {
    const html = render({ result: { name: "a.png", ok: true }, align: "center" });
    expect(html).toMatch(/^<div class="text-center">/);
  });
});
