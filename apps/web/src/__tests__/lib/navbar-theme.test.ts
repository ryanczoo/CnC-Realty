import { describe, it, expect } from "vitest";
import { isTransparentNavPath } from "@/lib/navbar-theme";

describe("isTransparentNavPath", () => {
  // Ryan (2026-11-19): the meeting Manage page (from the email's Manage button) gets the
  // Contact page's solid black bar; on its plain off-white page the see-through navbar's
  // white logo was nearly invisible.
  it("meeting Manage page is solid, like Contact", () => {
    expect(isTransparentNavPath("/booking/manage")).toBe(false);
    expect(isTransparentNavPath("/contact")).toBe(false);
  });

  it("pages with a photo/video hero stay see-through, including Property Management", () => {
    for (const p of ["/", "/join", "/buy", "/sell", "/rent", "/manage"]) {
      expect(isTransparentNavPath(p)).toBe(true);
    }
  });

  it("dashboard, admin, account and agent profiles stay solid", () => {
    for (const p of ["/dashboard", "/dashboard/leads/1", "/admin", "/account", "/agents/ryan", "/login", "/privacy"]) {
      expect(isTransparentNavPath(p)).toBe(false);
    }
  });
});
