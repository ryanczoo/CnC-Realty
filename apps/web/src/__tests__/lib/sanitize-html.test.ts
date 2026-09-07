import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("sanitizeHtml", () => {
  it("strips a script tag entirely", () => {
    const result = sanitizeHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Hello");
  });

  it("strips an inline event-handler attribute", () => {
    const result = sanitizeHtml('<img src="x.jpg" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });

  it("preserves the tags Tiptap's StarterKit actually outputs", () => {
    const html =
      "<p>Hi <strong>there</strong>, <em>welcome</em>.</p>" +
      "<ul><li>One</li><li>Two</li></ul>" +
      '<ol><li>First</li></ol>' +
      '<a href="https://example.com">a link</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain("<strong>there</strong>");
    expect(result).toContain("<em>welcome</em>");
    expect(result).toContain("<li>One</li>");
    expect(result).toContain("<li>Two</li>");
    expect(result).toContain("<li>First</li>");
    expect(result).toContain('href="https://example.com"');
  });
});
