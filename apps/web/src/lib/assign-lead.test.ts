import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assignLead } from "./assign-lead";

describe("assignLead", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it("PATCHes the existing assign route with the chosen agent", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/leads/lead-1/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "agent-9" }),
    });
  });

  it("returns the server's error message on failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Agent not found" }) });
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: false, error: "Agent not found" });
  });

  it("falls back to a generic message when the error body is unreadable", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new Error("bad json"); } });
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: false, error: "Assignment failed. Please try again." });
  });

  it("reports a network error without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: false, error: "Network error. Please try again." });
  });
});
