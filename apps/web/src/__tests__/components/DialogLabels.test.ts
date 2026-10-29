import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConvertListingModal } from "@/components/transactions/ConvertListingModal";

describe("pop-ups announce themselves to screen readers", () => {
  it("the Convert pop-up is a labelled modal dialog", () => {
    const html = renderToStaticMarkup(createElement(ConvertListingModal, {
      listingId: "l1", listingType: "RESIDENTIAL_SALE", onConverted: () => {}, onClose: () => {},
    }));
    expect(html).toMatch(/role="dialog"[^>]*aria-modal="true"[^>]*aria-label="Convert to Transaction"/);
  });
});
