import { describe, it, expect, afterEach } from "vitest";
import { formatSlotPT, formatTimePT } from "@/lib/booking/format";

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("booking format", () => {
  it("formats in Pacific even on a New York machine", () => {
    process.env.TZ = "America/New_York";
    expect(formatSlotPT(new Date("2026-11-17T18:15:00Z"))).toBe("Tue, Nov 17 · 10:15 AM PT");
    expect(formatTimePT(new Date("2026-11-17T18:15:00Z"))).toBe("10:15 AM");
  });
  it("emits no narrow/no-break spaces so server and browser text match", () => {
    const d = new Date("2026-11-17T18:15:00Z");
    expect(formatTimePT(d)).not.toMatch(/[  ]/);
    expect(formatSlotPT(d)).not.toMatch(/[  ]/);
  });
  it("formats in Pacific on a Tokyo machine", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(formatSlotPT(new Date("2026-11-17T18:15:00Z"))).toBe("Tue, Nov 17 · 10:15 AM PT");
  });
});
