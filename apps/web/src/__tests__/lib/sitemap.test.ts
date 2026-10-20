import { describe, it, expect } from "vitest";
import {
  LISTINGS_PER_SITEMAP,
  STATIC_SITEMAP_PATHS,
  EXCLUDED_AGENT_SLUGS,
  escapeXml,
  urlsetXml,
  sitemapIndexXml,
  listingSitemapCount,
} from "@/lib/sitemap";

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml("a&b<c")).toBe("a&amp;b&lt;c");
    expect(escapeXml(`>"'`)).toBe("&gt;&quot;&apos;");
  });
});

describe("urlsetXml", () => {
  it("writes the XML declaration, namespace and escaped locs", () => {
    const xml = urlsetXml([{ loc: "https://cncrealtygroup.com/a?x=1&y=2" }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://cncrealtygroup.com/a?x=1&amp;y=2</loc>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("writes lastmod as an ISO date when given", () => {
    const xml = urlsetXml([{ loc: "https://cncrealtygroup.com/", lastmod: new Date("2026-10-01T12:00:00.000Z") }]);
    expect(xml).toContain("<lastmod>2026-10-01T12:00:00.000Z</lastmod>");
  });
});

describe("sitemapIndexXml", () => {
  it("uses sitemapindex and lists each loc", () => {
    const xml = sitemapIndexXml(["https://cncrealtygroup.com/sitemaps/pages.xml"]);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<sitemap><loc>https://cncrealtygroup.com/sitemaps/pages.xml</loc></sitemap>");
  });
});

describe("listingSitemapCount", () => {
  it("chunks listings at 40,000 per file", () => {
    expect(LISTINGS_PER_SITEMAP).toBe(40_000);
    expect(listingSitemapCount(0)).toBe(0);
    expect(listingSitemapCount(40000)).toBe(1);
    expect(listingSitemapCount(40001)).toBe(2);
    expect(listingSitemapCount(190000)).toBe(5);
  });
});

describe("constants", () => {
  it("lists the public static paths and excludes the test agent", () => {
    expect(STATIC_SITEMAP_PATHS).toEqual([
      "/", "/buy", "/sell", "/rent", "/manage", "/join", "/press", "/home-value",
      "/contact", "/properties", "/accessibility", "/privacy", "/terms", "/fair-housing",
    ]);
    expect(EXCLUDED_AGENT_SLUGS).toEqual(["claude-test-agent"]);
  });
});
