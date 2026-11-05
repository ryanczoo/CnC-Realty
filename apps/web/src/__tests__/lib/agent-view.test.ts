import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { AGENT_VIEW_HEADER, withAgentView, adminFilePathFor } from "@/lib/agent-view";
import { actingRole } from "@/lib/api-auth";

const reqWith = (v: string) => new Request("http://x/", { headers: { [AGENT_VIEW_HEADER]: v } });
const reqWithout = new Request("http://x/");

describe("actingRole", () => {
  it("treats an admin sending the marker as an agent", () => {
    expect(actingRole("ADMIN", reqWith("1"))).toBe("AGENT");
  });
  it("leaves an admin without the marker as admin", () => {
    expect(actingRole("ADMIN", reqWithout)).toBe("ADMIN");
  });
  it("leaves an agent as agent", () => {
    expect(actingRole("AGENT", reqWith("1"))).toBe("AGENT");
  });
  it("never upgrades or changes a buyer", () => {
    expect(actingRole("BUYER", reqWith("1"))).toBe("BUYER");
  });
  it("ignores any marker value other than 1", () => {
    expect(actingRole("ADMIN", reqWith("0"))).toBe("ADMIN");
  });
});

describe("withAgentView", () => {
  it("adds the marker beside existing object headers", () => {
    const out = withAgentView({ headers: { "Content-Type": "application/json" } });
    const h = new Headers(out.headers);
    expect(h.get("Content-Type")).toBe("application/json");
    expect(h.get(AGENT_VIEW_HEADER)).toBe("1");
  });
  it("adds only the marker when no init is given", () => {
    const h = new Headers(withAgentView().headers);
    expect(h.get(AGENT_VIEW_HEADER)).toBe("1");
    expect(Array.from(h.keys())).toEqual([AGENT_VIEW_HEADER]);
  });
  it("keeps existing headers passed as a Headers instance", () => {
    const out = withAgentView({ headers: new Headers({ "Content-Type": "application/json" }) });
    const h = new Headers(out.headers);
    expect(h.get("Content-Type")).toBe("application/json");
    expect(h.get(AGENT_VIEW_HEADER)).toBe("1");
  });
  it("keeps other init fields", () => {
    expect(withAgentView({ method: "POST" }).method).toBe("POST");
  });
});

describe("adminFilePathFor", () => {
  it("returns the admin path when an admin views another agent's file", () => {
    expect(adminFilePathFor({ role: "ADMIN", agentId: "a1" }, { agentId: "a2" }, "transaction", "t9"))
      .toBe("/admin/transactions/transaction/t9");
  });
  it("returns null for the admin's own file", () => {
    expect(adminFilePathFor({ role: "ADMIN", agentId: "a1" }, { agentId: "a1" }, "transaction", "t9")).toBeNull();
  });
  it("returns null for an agent", () => {
    expect(adminFilePathFor({ role: "AGENT", agentId: "a1" }, { agentId: "a2" }, "listing", "l1")).toBeNull();
  });
  it("returns the admin path for an admin with no agent id", () => {
    expect(adminFilePathFor({ role: "ADMIN", agentId: null }, { agentId: "a2" }, "listing", "l1"))
      .toBe("/admin/transactions/listing/l1");
  });
});
