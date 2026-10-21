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
