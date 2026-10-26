import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer, onHomeLogoClick } from "@/components/layout/Footer";

describe("Footer logo", () => {
  it("links to the homepage", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>(?:(?!<\/a>)[\s\S])*logo-white\.png/);
  });
});

describe("onHomeLogoClick", () => {
  it("on the homepage, jumps to the top instead of navigating", () => {
    const e = { preventDefault: vi.fn() };
    const scroll = vi.fn();
    onHomeLogoClick("/", e, scroll);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(scroll).toHaveBeenCalled();
  });

  it("on any other page, lets the link navigate home", () => {
    const e = { preventDefault: vi.fn() };
    const scroll = vi.fn();
    onHomeLogoClick("/buy", e, scroll);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe("Footer phone", () => {
  it("shows the office phone under the address, tappable to call", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    expect(html).toMatch(/<a[^>]*href="tel:\+17147840369"[^>]*>(?:(?!<\/a>)[\s\S])*\(714\) 784-0369<\/a>/);
    expect(html.indexOf("(714) 784-0369")).toBeGreaterThan(html.indexOf("Santa Ana, CA 92701"));
  });
});
