import { describe, it, expect } from "vitest";
import {
  clampMonthSegment,
  clampDaySegment,
  clampYearSegment,
  clampYearOnBlur,
  buildDateValue,
  parseIso,
  clampHourSegment,
  clampMinuteSegment,
  buildDateTimeValue,
  parseDateTimeLocal,
} from "@/components/ui/DateField";

// ─── Date-only baseline — must keep passing unchanged after withTime is added ──

describe("clampMonthSegment", () => {
  it("strips non-digits", () => {
    expect(clampMonthSegment("a1b")).toBe("1");
  });
  it("caps at 2 digits", () => {
    expect(clampMonthSegment("12345")).toBe("12");
  });
  it("zero-pads a lone first digit greater than 1", () => {
    expect(clampMonthSegment("3")).toBe("03");
  });
  it("does not zero-pad a lone 1 (could become 10-12)", () => {
    expect(clampMonthSegment("1")).toBe("1");
  });
  it("clamps a two-digit value above 12 down to 12", () => {
    expect(clampMonthSegment("99")).toBe("12");
  });
  it("clamps a two-digit value of 00 up to 01", () => {
    expect(clampMonthSegment("00")).toBe("01");
  });
});

describe("clampDaySegment", () => {
  it("caps at 2 digits", () => {
    expect(clampDaySegment("126")).toBe("12");
  });
  it("zero-pads a lone first digit greater than 3", () => {
    expect(clampDaySegment("9")).toBe("09");
  });
  it("clamps a two-digit value above 31 down to 31", () => {
    expect(clampDaySegment("45")).toBe("31");
  });
  it("clamps a two-digit value of 00 up to 01", () => {
    expect(clampDaySegment("00")).toBe("01");
  });
});

describe("clampYearSegment", () => {
  it("caps at 4 digits — the exact overflow bug being fixed", () => {
    expect(clampYearSegment("222222")).toBe("2222");
  });
  it("strips non-digits", () => {
    expect(clampYearSegment("2a0b2c6")).toBe("2026");
  });
});

describe("clampYearOnBlur", () => {
  it("leaves an incomplete year untouched", () => {
    expect(clampYearOnBlur("20", 2000, 2030)).toBe("20");
  });
  it("clamps below minYear", () => {
    expect(clampYearOnBlur("1999", 2000, 2030)).toBe("2000");
  });
  it("clamps above maxYear", () => {
    expect(clampYearOnBlur("2099", 2000, 2030)).toBe("2030");
  });
  it("leaves a valid year unchanged", () => {
    expect(clampYearOnBlur("2015", 2000, 2030)).toBe("2015");
  });
  it("is a no-op when no bounds are given", () => {
    expect(clampYearOnBlur("9999")).toBe("9999");
  });
});

describe("buildDateValue", () => {
  it("returns an ISO date once all three segments are complete", () => {
    expect(buildDateValue("07", "10", "2026")).toBe("2026-07-10");
  });
  it("returns empty string when any segment is incomplete", () => {
    expect(buildDateValue("07", "10", "202")).toBe("");
    expect(buildDateValue("7", "10", "2026")).toBe("");
    expect(buildDateValue("07", "", "2026")).toBe("");
  });
});

describe("parseIso", () => {
  it("parses a valid ISO date", () => {
    expect(parseIso("2026-07-10")).toEqual({ year: "2026", month: "07", day: "10" });
  });
  it("returns empty segments for an invalid or empty string", () => {
    expect(parseIso("")).toEqual({ year: "", month: "", day: "" });
    expect(parseIso("not-a-date")).toEqual({ year: "", month: "", day: "" });
  });
});

// ─── New withTime segments — must not affect any of the above ─────────────────

describe("clampHourSegment", () => {
  it("caps at 2 digits", () => {
    expect(clampHourSegment("12345")).toBe("12");
  });
  it("zero-pads a lone first digit greater than 2", () => {
    expect(clampHourSegment("5")).toBe("05");
  });
  it("clamps a two-digit value above 23 down to 23", () => {
    expect(clampHourSegment("45")).toBe("23");
  });
});

describe("clampMinuteSegment", () => {
  it("caps at 2 digits", () => {
    expect(clampMinuteSegment("12345")).toBe("12");
  });
  it("zero-pads a lone first digit greater than 5", () => {
    expect(clampMinuteSegment("9")).toBe("09");
  });
  it("clamps a two-digit value above 59 down to 59", () => {
    expect(clampMinuteSegment("99")).toBe("59");
  });
});

describe("buildDateTimeValue", () => {
  it("returns a datetime-local string once all five segments are complete", () => {
    expect(buildDateTimeValue("07", "10", "2026", "14", "30")).toBe("2026-07-10T14:30");
  });
  it("returns empty string when any segment is incomplete", () => {
    expect(buildDateTimeValue("07", "10", "2026", "14", "3")).toBe("");
    expect(buildDateTimeValue("07", "10", "2026", "", "30")).toBe("");
  });
});

describe("parseDateTimeLocal", () => {
  it("parses a valid datetime-local value", () => {
    expect(parseDateTimeLocal("2026-07-10T14:30")).toEqual({
      year: "2026", month: "07", day: "10", hour: "14", minute: "30",
    });
  });
  it("returns empty segments for an invalid or empty string", () => {
    expect(parseDateTimeLocal("")).toEqual({ year: "", month: "", day: "", hour: "", minute: "" });
  });
});
