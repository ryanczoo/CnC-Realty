import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));

import { PropertyCard, isPlainClick } from "@/components/properties/PropertyCard";

const property = {
  mlsNumber: "1149821494", address: "1 Main St", city: "Cerritos", state: "CA", zip: "90703",
  listPrice: 900000, beds: 3, baths: 2, sqft: 1500, photos: [], status: "Active",
  propertyType: "SingleFamilyResidence", listingType: "FOR_SALE",
} as any;

describe("PropertyCard on the search page", () => {
  it("is a real link to the listing so crawlers can follow it", () => {
    const html = renderToStaticMarkup(
      React.createElement(PropertyCard, { property, isSaved: false, onToggleSave: () => {}, onSelect: () => {} }),
    );
    expect(html).toMatch(/^<a href="\/properties\/1149821494"/);
    expect(html).toContain("outline-none");
  });

  it("opens the popup only on a plain left click", () => {
    const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(isPlainClick(base)).toBe(true);
    expect(isPlainClick({ ...base, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...base, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...base, shiftKey: true })).toBe(false);
    expect(isPlainClick({ ...base, button: 1 })).toBe(false);
  });
});
