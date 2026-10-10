import { describe, it, expect } from "vitest";
import { ACCOUNT_TABS, accountTabShortLabel } from "@/lib/account-tabs";

describe("account tabs", () => {
  it("keeps the three full tab names in order (tab state uses these)", () => {
    expect([...ACCOUNT_TABS]).toEqual(["Saved Properties", "Tour Requests", "Settings"]);
  });

  it("gives each tab a short phone label", () => {
    expect(accountTabShortLabel("Saved Properties")).toBe("Saved");
    expect(accountTabShortLabel("Tour Requests")).toBe("Tours");
    expect(accountTabShortLabel("Settings")).toBe("Settings");
  });

  it("every short label is no longer than its full name and not empty", () => {
    for (const t of ACCOUNT_TABS) {
      const s = accountTabShortLabel(t);
      expect(s.length, t).toBeGreaterThan(0);
      expect(s.length, t).toBeLessThanOrEqual(t.length);
    }
  });
});
