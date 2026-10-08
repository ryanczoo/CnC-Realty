import { describe, it, expect } from "vitest";
import { wizardStepIndex, wizardStepLabel } from "@/lib/wizard-steps";

const SIX = ["File Type", "Property", "Details", "Parties", "Commission", "Review"];
const REFERRAL = ["File Type", "Referral Details", "Review"];

describe("wizardStepLabel", () => {
  it("names the current step out of the total", () => {
    expect(wizardStepLabel(SIX, 0)).toBe("Step 1 of 6 · File Type");
    expect(wizardStepLabel(SIX, 1)).toBe("Step 2 of 6 · Property");
    expect(wizardStepLabel(SIX, 5)).toBe("Step 6 of 6 · Review");
  });

  it("clamps an index past the end to the last step (referral reuses index 5 for Review)", () => {
    expect(wizardStepLabel(REFERRAL, 5)).toBe("Step 3 of 3 · Review");
    expect(wizardStepIndex(REFERRAL, 5)).toBe(2);
  });

  it("clamps a negative index to the first step", () => {
    expect(wizardStepLabel(SIX, -1)).toBe("Step 1 of 6 · File Type");
    expect(wizardStepIndex(SIX, -1)).toBe(0);
  });

  it("returns an empty label for an empty step list", () => {
    expect(wizardStepLabel([], 0)).toBe("");
  });
});
