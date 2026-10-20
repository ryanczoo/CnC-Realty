import { SITE_URL } from "@/lib/seo";

export const LISTINGS_PER_SITEMAP = 40_000;

// Every public page that should be indexed. /about is deliberately absent (no such page).
export const STATIC_SITEMAP_PATHS = [
  "/", "/buy", "/sell", "/rent", "/manage", "/join", "/press", "/home-value",
  "/contact", "/properties", "/accessibility", "/privacy", "/terms", "/fair-housing",
];

// Test fixtures that exist in the shared database but must never be advertised.
export const EXCLUDED_AGENT_SLUGS = ["claude-test-agent"];

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function urlsetXml(entries: { loc: string; lastmod?: Date }[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : "";
      return `<url><loc>${escapeXml(e.loc)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `${XML_HEADER}<urlset xmlns="${NS}">${urls}</urlset>`;
}

export function sitemapIndexXml(locs: string[]): string {
  const items = locs.map((l) => `<sitemap><loc>${escapeXml(l)}</loc></sitemap>`).join("");
  return `${XML_HEADER}<sitemapindex xmlns="${NS}">${items}</sitemapindex>`;
}

export function listingSitemapCount(total: number): number {
  return Math.max(0, Math.ceil(total / LISTINGS_PER_SITEMAP));
}

export const sitemapUrl = (name: string) => `${SITE_URL}/sitemaps/${name}`;

export const XML_RESPONSE_HEADERS = { "Content-Type": "application/xml; charset=utf-8" };
