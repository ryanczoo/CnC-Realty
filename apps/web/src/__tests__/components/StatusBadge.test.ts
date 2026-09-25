import { describe, it, expect } from "vitest";
import { statusLabel } from "@/components/transactions/StatusBadge";

describe("statusLabel", () => {
  it("uses the badge's readable label", () => {
    expect(statusLabel("ACTIVE_UNDER_CONTRACT")).toBe("Under Contract");
    expect(statusLabel("CANCELED_PENDING")).toBe("Cancel Pending");
  });

  it("falls back to the raw value with spaces for an unknown status", () => {
    expect(statusLabel("SOME_NEW_STATUS")).toBe("SOME NEW STATUS");
  });
});
