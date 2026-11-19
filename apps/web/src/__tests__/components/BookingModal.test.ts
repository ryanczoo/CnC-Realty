import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingModal } from "@/components/booking/BookingModal";

const render = () =>
  renderToStaticMarkup(
    createElement(BookingModal, {
      slot: "2026-11-20T18:30:00.000Z",
      page: "CONTACT",
      prefill: null,
      recruitToken: null,
      onClose: () => {},
      onTaken: () => {},
    })
  );

describe("BookingModal form", () => {
  // Ryan (2026-11-18): the submit button reads just "Confirm", matching the Manage page's
  // reschedule button.
  it("submit button reads exactly Confirm", () => {
    const html = render();
    const submit = html.match(/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    expect(submit?.trim()).toBe("Confirm");
    expect(html).not.toContain("Confirm Call");
  });
});
