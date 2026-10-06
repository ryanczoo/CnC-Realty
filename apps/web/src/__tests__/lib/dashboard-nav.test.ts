import { describe, it, expect } from "vitest";
import { dashboardPageTitle, dashboardNavMatch, AGENT_NAV, ADMIN_NAV } from "@/lib/dashboard-nav";

describe("dashboardPageTitle", () => {
  it("names pages that are in the nav", () => {
    expect(dashboardPageTitle("/dashboard", false)).toBe("Overview");
    expect(dashboardPageTitle("/dashboard/settings", false)).toBe("Settings");
    expect(dashboardPageTitle("/dashboard/academy/videos", false)).toBe("Training Videos");
    expect(dashboardPageTitle("/admin/agents", true)).toBe("All Agents");
  });
  it("names detail and wizard pages after their section", () => {
    expect(dashboardPageTitle("/dashboard/leads/abc123", false)).toBe("Leads");
    expect(dashboardPageTitle("/dashboard/transactions/new-listing", false)).toBe("Transactions");
    expect(dashboardPageTitle("/admin/transactions/listing/xyz", true)).toBe("All Files");
    expect(dashboardPageTitle("/admin/blog/xyz/edit", true)).toBe("Blog");
  });
  it("names admin pages that are not in the nav", () => {
    expect(dashboardPageTitle("/admin", true)).toBe("Admin Overview");
    expect(dashboardPageTitle("/admin/reports", true)).toBe("Reports");
    expect(dashboardPageTitle("/admin/triggers", true)).toBe("Triggers");
  });
  it("matches whole path segments only and never returns blank", () => {
    expect(dashboardPageTitle("/dashboard/leadsfoo", false)).toBe("Overview");
    expect(dashboardPageTitle("/admin/agents", false)).toBe("Dashboard");
    expect(dashboardPageTitle("/somewhere", false)).toBe("Dashboard");
  });
});

describe("dashboardNavMatch", () => {
  it("returns the nav item to highlight (longest match)", () => {
    expect(dashboardNavMatch("/dashboard/leads/abc", false)).toEqual({ href: "/dashboard/leads", label: "Leads" });
    expect(dashboardNavMatch("/admin/settings/tags", true)).toEqual({ href: "/admin/settings/tags", label: "Tags" });
    expect(dashboardNavMatch("/admin/reports", true)).toEqual({ href: "/admin", label: "Overview" });
  });
  it("keeps the nav lists exactly as the sidebar had them", () => {
    expect(AGENT_NAV.map((i) => i.label)).toEqual(["Overview", "Leads", "Pipeline", "Tasks", "Transactions", "Campaigns"]);
    expect(ADMIN_NAV.map((i) => i.label)).toEqual(["Overview", "All Agents", "All Leads", "All Files", "Applications", "Action Plans", "Checklists", "Blog", "Tags"]);
  });
});
