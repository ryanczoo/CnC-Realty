import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BookingCalendar from "@/components/booking/BookingCalendar";
import { dayState } from "@/components/booking/MonthGrid";
import { TimeList } from "@/components/booking/TimeList";
import { BookingSuccess } from "@/components/booking/BookingModal";

const noop = () => {};

describe("dayState", () => {
  const days = { "2026-11-17": ["2026-11-17T18:15:00.000Z"], "2026-11-18": [] as string[] };
  it("closed when the day has no slots or is not in the window", () => {
    expect(dayState("2026-11-18", days, null)).toBe("closed");
    expect(dayState("2026-11-30", days, null)).toBe("closed");
  });
  it("open when the day has at least one slot", () => {
    expect(dayState("2026-11-17", days, null)).toBe("open");
  });
  it("selected when it is the picked day", () => {
    expect(dayState("2026-11-17", days, "2026-11-17")).toBe("selected");
  });
});

describe("BookingCalendar markup", () => {
  it("first render (before slots load) has the shared heading and no Pacific Time label", () => {
    const html = renderToStaticMarkup(
      createElement(BookingCalendar, { mode: { kind: "book", page: "CONTACT" } }),
    );
    expect(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain("Meet with RYAN");
    expect(html).not.toMatch(/Pacific Time/i);
    expect(html).not.toMatch(/Times shown in/i);
  });
});

describe("TimeList markup", () => {
  it("shows Pacific times with aria labels, gold for the chosen one, no Pacific Time label", () => {
    const slots = ["2026-11-17T18:15:00.000Z", "2026-11-17T18:30:00.000Z"];
    const html = renderToStaticMarkup(
      createElement(TimeList, { slots, chosen: slots[0], onPick: noop, notice: null }),
    );
    expect(html).toContain('aria-label="10:15 AM"');
    expect(html).toContain("10:30 AM");
    expect(html).toContain("bg-[#9E8C61]");
    expect(html).not.toMatch(/Pacific Time/i);
  });
  it("shows the taken notice above the times", () => {
    const html = renderToStaticMarkup(
      createElement(TimeList, {
        slots: ["2026-11-17T18:15:00.000Z"],
        chosen: null,
        onPick: noop,
        notice: "That time was just taken, please pick another.",
      }),
    );
    expect(html.indexOf("just taken")).toBeLessThan(html.indexOf("10:15 AM"));
  });
});

describe("BookingSuccess markup", () => {
  it("shows the booked time, meeting type and manage links", () => {
    const html = renderToStaticMarkup(
      createElement(BookingSuccess, {
        startsAt: "2026-11-17T18:15:00.000Z",
        meetingType: "MEET",
        manageUrl: "https://example.com/booking/manage?t=abc",
      }),
    );
    expect(html).toContain("You&#x27;re booked!");
    expect(html).toContain("Tue, Nov 17 · 10:15 AM PT · Google Meet");
    expect(html).toContain("A calendar invite is on its way to your email.");
    expect(html.match(/href="https:\/\/example.com\/booking\/manage\?t=abc"/g)).toHaveLength(2);
    expect(html).toContain(">Reschedule<");
    expect(html).toContain(">Cancel<");
  });
  it("says Phone call for phone bookings", () => {
    const html = renderToStaticMarkup(
      createElement(BookingSuccess, { startsAt: "2026-11-17T18:15:00.000Z", meetingType: "PHONE", manageUrl: "/m" }),
    );
    expect(html).toContain("10:15 AM PT · Phone call");
  });
});
