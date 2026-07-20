import { describe, it, expect } from "vitest";
import { checkOwnership } from "@/lib/api-auth";

describe("checkOwnership", () => {
  it("reports not-exists when the record is null, regardless of role", () => {
    expect(checkOwnership(null, "agent-1", "AGENT")).toEqual({ exists: false, forbidden: false, record: null });
    expect(checkOwnership(null, "agent-1", "ADMIN")).toEqual({ exists: false, forbidden: false, record: null });
  });

  it("ADMIN is never forbidden on an existing record", () => {
    const record = { agentId: "someone-else" };
    expect(checkOwnership(record, "agent-1", "ADMIN")).toEqual({ exists: true, forbidden: false, record });
  });

  it("AGENT is allowed when the record's agentId matches their own", () => {
    const record = { agentId: "agent-1" };
    expect(checkOwnership(record, "agent-1", "AGENT")).toEqual({ exists: true, forbidden: false, record });
  });

  it("AGENT is forbidden when the record's agentId does not match", () => {
    const record = { agentId: "someone-else" };
    expect(checkOwnership(record, "agent-1", "AGENT")).toEqual({ exists: true, forbidden: true, record });
  });

  it("is forbidden when the caller's own agentId is null, even if the record's agentId is also null", () => {
    // Regression test for the real gap this task fixes: a bare `!==`
    // comparison would grant access here (null !== null is false), letting
    // an AGENT-role session with no linked Agent record yet access any
    // resource that also happens to have a null agentId.
    const record = { agentId: null };
    expect(checkOwnership(record, null, "AGENT")).toEqual({ exists: true, forbidden: true, record });
  });
});
