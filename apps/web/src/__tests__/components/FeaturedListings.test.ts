import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/home/ListingsMarquee", () => ({ ListingsMarquee: () => null }));

import { FeaturedListings } from "@/components/home/FeaturedListings";

describe("FeaturedListings title", () => {
  it("puts the real count and city in the server HTML for crawlers", () => {
    const html = renderToStaticMarkup(
      React.createElement(FeaturedListings, { listings: [], city: "Cerritos", count: 1234 }),
    );
    expect(html).toContain('<span class="sr-only">1,234+ Listings in Cerritos</span>');
  });
});
