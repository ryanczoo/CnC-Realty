import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";

// 2026-11-19: a transient Google Fonts response failed a Vercel build (next/font/google
// downloads at build time). All fonts are now files in src/app/fonts.
const appDir = path.join(__dirname, "../../app");
const layout = readFileSync(path.join(appDir, "layout.tsx"), "utf8");
const tailwind = readFileSync(path.join(__dirname, "../../../tailwind.config.ts"), "utf8");

describe("site fonts are self-hosted", () => {
  it("never downloads from Google Fonts at build time", () => {
    expect(layout).not.toContain("next/font/google");
  });

  it("serves Inter (Join StatsBar numbers, font-chopin) from a local file", () => {
    expect(existsSync(path.join(appDir, "fonts/Inter-latin.woff2"))).toBe(true);
    expect(layout).toMatch(/src:\s*"\.\/fonts\/Inter-latin\.woff2"/);
    expect(layout).toContain('variable: "--font-chopin"');
  });

  it("does not preload Inter on every page (only Join uses it)", () => {
    const inter = layout.slice(layout.indexOf("Inter-latin.woff2"));
    expect(inter.slice(0, inter.indexOf("});"))).toMatch(/preload:\s*false/);
  });

  it("drops the unused Cormorant Garamond display font", () => {
    expect(layout).not.toMatch(/Cormorant/);
    expect(tailwind).not.toContain("--font-display");
  });
});
