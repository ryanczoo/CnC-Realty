import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FileStatusSelect } from "@/components/transactions/FileStatusSelect";

const render = () => renderToStaticMarkup(createElement(FileStatusSelect, { current: "INCOMPLETE", statuses: ["INCOMPLETE", "ACTIVE"], onChange: () => {} }));

describe("FileStatusSelect", () => {
  it("is a black pill with white text", () => {
    const html = render();
    expect(html).toMatch(/<select[^>]*class="[^"]*bg-\[#1B1B1B\][^"]*text-white/);
    expect(html).not.toMatch(/<select[^>]*class="[^"]*bg-white/);
  });
  it("keeps the opened list readable (dark text on white)", () => {
    expect(render()).toMatch(/<option[^>]*class="bg-white text-\[#1B1B1B\]"/);
  });
});
