import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SelectOptions } from "@/components/transactions/InfoRow";

const render = (current?: string) =>
  renderToStaticMarkup(createElement("select", null, createElement(SelectOptions, { options: ["Listing", "Both Purchase & Listing"], current })));

describe("InfoRow select options", () => {
  it("marks the current choice and greys it out", () => {
    const html = render("Listing");
    expect(html).toContain('<option value="Listing" disabled="">Listing (current)</option>');
    expect(html).toContain('<option value="Both Purchase &amp; Listing">Both Purchase &amp; Listing</option>');
  });
  it("lists plain options when there is no current choice", () => {
    expect(render()).toContain('<option value="Listing">Listing</option>');
    expect(render()).toContain('<option value="">Select…</option>');
  });
});
