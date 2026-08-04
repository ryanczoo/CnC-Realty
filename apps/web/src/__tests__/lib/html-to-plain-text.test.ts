import { describe, it, expect } from "vitest";
import { htmlToPlainText } from "@/lib/email";

describe("htmlToPlainText", () => {
  it("strips simple tags down to their text content", () => {
    expect(htmlToPlainText("<p>Hello</p>")).toBe("Hello");
  });

  it("converts <br> into a newline", () => {
    expect(htmlToPlainText("Line1<br>Line2")).toBe("Line1\nLine2");
  });

  it("separates paragraphs with a blank line", () => {
    expect(htmlToPlainText("<p>A</p><p>B</p>")).toBe("A\n\nB");
  });

  it("renders a link as its text followed by the URL in parens", () => {
    expect(htmlToPlainText('<a href="https://cncrealtygroup.com">Click here</a>')).toBe(
      "Click here (https://cncrealtygroup.com)"
    );
  });

  it("renders list items with a leading dash, one per line", () => {
    expect(htmlToPlainText("<ul><li>One</li><li>Two</li></ul>")).toBe("- One\n- Two");
  });

  it("decodes common HTML entities", () => {
    expect(htmlToPlainText("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("strips unknown/style-bearing tags without leaving artifacts", () => {
    expect(htmlToPlainText('<div style="color:red"><strong>Bold</strong></div>')).toBe("Bold");
  });

  it("collapses more than two consecutive newlines down to two", () => {
    expect(htmlToPlainText("<p>A</p>\n\n\n\n<p>B</p>")).toBe("A\n\nB");
  });

  it("trims leading and trailing whitespace from the result", () => {
    expect(htmlToPlainText("   <p>Hi</p>   ")).toBe("Hi");
  });

  it("removes the entire <head> block including its content", () => {
    expect(
      htmlToPlainText("<html><head><title>Ignore Me</title></head><body><p>Visible</p></body></html>")
    ).toBe("Visible");
  });

  it("separates table rows with a blank line", () => {
    expect(
      htmlToPlainText("<table><tr><td>Row1</td></tr><tr><td>Row2</td></tr></table>")
    ).toBe("Row1\n\nRow2");
  });

  it("decodes additional common HTML entities", () => {
    expect(htmlToPlainText("You&rsquo;re set &bull; &copy;2026 &mdash; done&hellip;")).toBe(
      "You're set • ©2026 — done…"
    );
  });
});
