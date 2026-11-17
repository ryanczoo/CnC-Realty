import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModalShell } from "@/components/ui/ModalShell";

function render(props: { open: boolean; fullScreenOnMobile?: boolean }) {
  return renderToStaticMarkup(
    createElement(ModalShell, { onClose: () => {}, label: "Test Pop-up", children: createElement("p", null, "inside"), ...props }),
  );
}

describe("ModalShell", () => {
  it("renders a labelled dialog with its children when open", () => {
    const html = render({ open: true });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Test Pop-up"');
    expect(html).toContain("inside");
  });

  it("renders nothing when closed", () => {
    expect(render({ open: false })).toBe("");
  });

  it("adds the full-screen mobile classes only with fullScreenOnMobile", () => {
    expect(render({ open: true, fullScreenOnMobile: true })).toContain("max-lg:inset-0");
    expect(render({ open: true })).not.toContain("max-lg:inset-0");
  });
});
