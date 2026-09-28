import { describe, it, expect } from "vitest";
import { UNASSIGNED_LEADS_WHERE } from "./unassigned-leads";

describe("UNASSIGNED_LEADS_WHERE", () => {
  it("is the brokerage's unassigned leads, minus newsletter signups", () => {
    // A newsletter signup has no agent by design; it isn't a lead waiting to
    // be assigned, so it stays out of the unassigned banner and list.
    expect(UNASSIGNED_LEADS_WHERE).toEqual({ agentId: null, source: { not: "NEWSLETTER" } });
  });
});
