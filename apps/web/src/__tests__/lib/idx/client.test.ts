import { describe, it, expect } from "vitest";
import { buildPropertyFilter } from "@/lib/idx/client";

describe("buildPropertyFilter", () => {
  it("includes the status filter with no ModificationTimestamp clause when modifiedSince is omitted", () => {
    expect(buildPropertyFilter()).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')&"
    );
  });

  it("combines the status filter with a ModificationTimestamp clause when modifiedSince is given", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    expect(buildPropertyFilter(since)).toBe(
      "$filter=StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed') and ModificationTimestamp gt 2026-07-01T00:00:00.000Z&"
    );
  });
});
