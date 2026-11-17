import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PageCTA } from "@/components/ui/PageCTA";
import { JoinCTAButtons } from "@/components/join/JoinCTAButtons";
import { CTA_MESSAGE_CLS } from "@/components/ui/cta-styles";

function messageButtonClass(html: string): string {
  const match = html.match(/<button[^>]*class="([^"]*)"[^>]*>\s*Message\s*<\/button>/);
  if (!match) throw new Error("Message button not found in markup");
  return match[1];
}

describe("CTA_MESSAGE_CLS", () => {
  it("is a solid-bordered white pill", () => {
    expect(CTA_MESSAGE_CLS).toContain("bg-white");
    expect(CTA_MESSAGE_CLS).toContain("border-[#1B1B1B] ");
    expect(CTA_MESSAGE_CLS).not.toContain("/20");
  });
});

describe("PageCTA Message button", () => {
  it("default secondary style is the white solid-border Message button", () => {
    const html = renderToStaticMarkup(
      createElement(PageCTA, { heading: "x", secondaryLabel: "Message", showContactModal: true }),
    );
    const cls = messageButtonClass(html);
    expect(cls).toContain("bg-white");
    expect(cls).toContain("border-[#1B1B1B] ");
    expect(cls).not.toContain("border-[#1B1B1B]/20");
  });

  it("explicit secondaryClassName override (Manage gold) keeps gold and drops white", () => {
    const html = renderToStaticMarkup(
      createElement(PageCTA, {
        heading: "x",
        secondaryLabel: "Message",
        showContactModal: true,
        secondaryClassName: "inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white",
      }),
    );
    const cls = messageButtonClass(html);
    expect(cls).toContain("bg-[#9E8C61]");
    expect(cls).not.toContain("bg-white");
  });
});

describe("JoinCTAButtons Message button", () => {
  it("uses CTA_MESSAGE_CLS", () => {
    const html = renderToStaticMarkup(createElement(JoinCTAButtons));
    expect(messageButtonClass(html)).toBe(CTA_MESSAGE_CLS);
  });
});
