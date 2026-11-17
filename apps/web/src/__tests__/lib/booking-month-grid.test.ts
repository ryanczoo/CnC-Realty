import { describe, it, expect } from "vitest";
import { buildMonthGrid, windowMonths, dayLabel, monthTitle, firstOpenDay } from "@/lib/booking/month-grid";

describe("buildMonthGrid", () => {
  it("Nov 2026 starts on a Sunday with no padding and fills 5 weeks", () => {
    const g = buildMonthGrid(2026, 10);
    expect(g[0]).toBe("2026-11-01");
    expect(g).toHaveLength(35);
    expect(g[29]).toBe("2026-11-30");
    expect(g.slice(30)).toEqual([null, null, null, null, null]);
  });

  it("Feb 2027 has 1 leading null (Feb 1 is a Monday) and pads to a full week", () => {
    const g = buildMonthGrid(2027, 1);
    expect(g[0]).toBeNull();
    expect(g[1]).toBe("2027-02-01");
    expect(g).toHaveLength(35);
    expect(g[28]).toBe("2027-02-28");
    expect(g.length % 7).toBe(0);
  });

  it("a 6-week month (Aug 2026 starts Saturday) is 42 cells", () => {
    const g = buildMonthGrid(2026, 7);
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-08-01"]);
    expect(g).toHaveLength(42);
  });
});

describe("windowMonths", () => {
  it("one month when the window stays inside it", () => {
    expect(windowMonths("2026-11-01", "2026-11-15")).toEqual([{ year: 2026, month0: 10 }]);
  });
  it("spans a year boundary", () => {
    expect(windowMonths("2026-12-25", "2027-01-08")).toEqual([
      { year: 2026, month0: 11 },
      { year: 2027, month0: 0 },
    ]);
  });
});

describe("labels", () => {
  it("dayLabel is weekday, month day", () => {
    expect(dayLabel("2026-11-17")).toBe("Tuesday, November 17");
  });
  it("monthTitle is month year", () => {
    expect(monthTitle(2026, 10)).toBe("November 2026");
  });
});

describe("firstOpenDay", () => {
  it("earliest date that has at least one slot", () => {
    expect(firstOpenDay({ "2026-11-18": ["x"], "2026-11-16": [], "2026-11-17": ["y"] })).toBe("2026-11-17");
  });
  it("null when nothing is open", () => {
    expect(firstOpenDay({})).toBeNull();
  });
});
