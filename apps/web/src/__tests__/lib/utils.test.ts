import { describe, it, expect } from "vitest";
import { formatCompactCurrency, formatDateOnly, formatDate } from "@/lib/utils";

describe("formatCompactCurrency", () => {
  it("strips a trailing .0 for whole millions", () => {
    expect(formatCompactCurrency(1_000_000)).toBe("$1M");
  });

  it("shows 1 decimal place for non-whole millions", () => {
    expect(formatCompactCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCompactCurrency(1_234_567)).toBe("$1.2M");
  });

  it("formats thousands with a lowercase-free K suffix and no decimals", () => {
    expect(formatCompactCurrency(725_000)).toBe("$725K");
  });

  it("formats sub-thousand values with a plain dollar sign", () => {
    expect(formatCompactCurrency(500)).toBe("$500");
  });

  it("returns an em dash for null", () => {
    expect(formatCompactCurrency(null)).toBe("—");
  });
});

// Reproduce the California bug: date-only fields are stored as UTC midnight and
// were rendered in local time, which is the previous evening in Pacific time.
process.env.TZ = "America/Los_Angeles";

describe("formatDateOnly", () => {
  it("environment check: plain local formatting shifts a UTC-midnight date back one day (the bug)", () => {
    expect(new Date("2026-09-21T00:00:00.000Z").toLocaleDateString("en-US")).toBe("9/20/2026");
  });

  it("shows the stored calendar day, not the previous evening", () => {
    expect(formatDateOnly("2026-09-21T00:00:00.000Z")).toBe("9/21/2026");
  });

  it("accepts a Date object", () => {
    expect(formatDateOnly(new Date("2026-10-02T00:00:00.000Z"))).toBe("10/2/2026");
  });

  it("supports custom formatting options", () => {
    expect(formatDateOnly("2026-10-22T00:00:00.000Z", { month: "short", year: "numeric" })).toBe("Oct 2026");
    expect(formatDateOnly("2026-10-02T00:00:00.000Z", { weekday: "long", month: "long", day: "numeric" })).toBe("Friday, October 2");
  });

  it("does not slip a month boundary (Nov 1 stays November)", () => {
    expect(formatDateOnly("2026-11-01T00:00:00.000Z", { month: "short", year: "numeric" })).toBe("Nov 2026");
  });
});

describe("formatDate (unchanged behavior)", () => {
  it("still formats real timestamps in local time", () => {
    expect(formatDate("2026-09-21T02:00:00.000Z")).toBe("Sep 20, 2026");
  });
});
