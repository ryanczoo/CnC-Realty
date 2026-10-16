import { describe, it, expect } from "vitest";
import { formatCrmlsUpdated } from "@/lib/crmls-updated";

// Vercel servers run in UTC; the listing page renders this on the server, so
// the time must be pinned to Pacific rather than the machine's zone.
process.env.TZ = "UTC";

describe("formatCrmlsUpdated", () => {
  it("shows the time in Pacific even when the machine runs in UTC", () => {
    expect(formatCrmlsUpdated("2026-10-16T15:00:25.430Z")).toBe("October 16, 2026 at 8:00 AM");
  });

  it("rolls back to the Pacific calendar day late in the UTC evening", () => {
    expect(formatCrmlsUpdated("2026-10-17T02:30:00.000Z")).toBe("October 16, 2026 at 7:30 PM");
  });

  it("returns null when there is no sync time yet", () => {
    expect(formatCrmlsUpdated(null)).toBeNull();
  });
});
