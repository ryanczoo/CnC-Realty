import { describe, it, expect } from "vitest";
import { TC_FEE, calcNetToAgent } from "@/lib/commission";

describe("calcNetToAgent", () => {
  it("subtracts only other deductions when TC fee is disabled", () => {
    expect(calcNetToAgent(10000, 500, false)).toBe(9500);
  });

  it("subtracts other deductions and the TC fee when enabled", () => {
    expect(calcNetToAgent(10000, 500, true)).toBe(10000 - 500 - TC_FEE);
  });

  it("treats zero deductions correctly", () => {
    expect(calcNetToAgent(5000, 0, false)).toBe(5000);
  });
});
