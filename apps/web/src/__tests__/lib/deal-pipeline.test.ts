import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  isValidStageForPipeline,
  calcDaysInStage,
  formatDealPrice,
  formatCloseDate,
} from "@/lib/deal-pipeline";

describe("PIPELINE_STAGES", () => {
  it("BUYERS includes PRE_APPROVAL and OFFER_ACCEPTED", () => {
    expect(PIPELINE_STAGES.BUYERS).toContain("PRE_APPROVAL");
    expect(PIPELINE_STAGES.BUYERS).toContain("OFFER_ACCEPTED");
    expect(PIPELINE_STAGES.BUYERS).toContain("FALLEN_OUT");
  });

  it("SELLERS includes LISTING_APPOINTMENT and OFFER_ACCEPTED", () => {
    expect(PIPELINE_STAGES.SELLERS).toContain("LISTING_APPOINTMENT");
    expect(PIPELINE_STAGES.SELLERS).toContain("ACTIVE_LISTING");
    expect(PIPELINE_STAGES.SELLERS).toContain("OFFER_ACCEPTED");
  });

  it("SELLERS does NOT include PRE_APPROVAL or TOURING", () => {
    expect(PIPELINE_STAGES.SELLERS).not.toContain("PRE_APPROVAL");
    expect(PIPELINE_STAGES.SELLERS).not.toContain("TOURING");
  });

  it("BUYERS does NOT include LISTING_APPOINTMENT or ACTIVE_LISTING", () => {
    expect(PIPELINE_STAGES.BUYERS).not.toContain("LISTING_APPOINTMENT");
    expect(PIPELINE_STAGES.BUYERS).not.toContain("ACTIVE_LISTING");
  });
});

describe("isValidStageForPipeline", () => {
  it("returns true for BUYERS + PRE_APPROVAL", () => {
    expect(isValidStageForPipeline("PRE_APPROVAL", "BUYERS")).toBe(true);
  });

  it("returns false for BUYERS + LISTING_APPOINTMENT", () => {
    expect(isValidStageForPipeline("LISTING_APPOINTMENT", "BUYERS")).toBe(false);
  });

  it("returns true for SELLERS + ACTIVE_LISTING", () => {
    expect(isValidStageForPipeline("ACTIVE_LISTING", "SELLERS")).toBe(true);
  });

  it("returns true for shared stage OFFER_ACCEPTED on BUYERS", () => {
    expect(isValidStageForPipeline("OFFER_ACCEPTED", "BUYERS")).toBe(true);
  });

  it("returns true for shared stage FALLEN_OUT on SELLERS", () => {
    expect(isValidStageForPipeline("FALLEN_OUT", "SELLERS")).toBe(true);
  });
});

describe("calcDaysInStage", () => {
  it("returns 0 for a date just set to now", () => {
    const now = new Date();
    expect(calcDaysInStage(now)).toBe(0);
  });

  it("returns 3 for a date 3 days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000);
    expect(calcDaysInStage(threeDaysAgo)).toBe(3);
  });

  it("accepts a string date", () => {
    const d = new Date(Date.now() - 7 * 86400_000).toISOString();
    expect(calcDaysInStage(d)).toBe(7);
  });
});

describe("formatDealPrice", () => {
  it("returns '—' for null", () => {
    expect(formatDealPrice(null)).toBe("—");
  });

  it("formats thousands as k", () => {
    expect(formatDealPrice(850000)).toBe("$850k");
  });

  it("formats millions with one decimal", () => {
    expect(formatDealPrice(1_200_000)).toBe("$1.2M");
  });

  it("rounds to nearest 10k for sub-million", () => {
    expect(formatDealPrice(495_000)).toBe("$495k");
  });
});

describe("formatCloseDate", () => {
  it("returns '—' for null", () => {
    expect(formatCloseDate(null)).toBe("—");
  });

  it("formats as 'Jul 15'", () => {
    const d = new Date("2026-07-15T00:00:00.000Z");
    const result = formatCloseDate(d);
    expect(result).toMatch(/Jul/);
    expect(result).toMatch(/15/);
  });

  it("accepts string dates", () => {
    expect(formatCloseDate("2026-12-01T00:00:00.000Z")).toMatch(/Dec/);
  });
});

describe("STAGE_LABELS", () => {
  it("has a label for every DealStage value", () => {
    const stages = [
      "PRE_APPROVAL", "TOURING", "OFFER_SUBMITTED",
      "LISTING_APPOINTMENT", "ACTIVE_LISTING",
      "OFFER_ACCEPTED", "FALLEN_OUT",
    ];
    for (const s of stages) {
      expect(STAGE_LABELS[s]).toBeTruthy();
    }
  });
});

describe("lease pipelines", () => {
  it("LEASE_TENANT has the correct stage list", () => {
    expect(PIPELINE_STAGES.LEASE_TENANT).toEqual(["SEARCHING", "TOURING", "APPLICATION_SUBMITTED", "LEASE_SIGNED", "FALLEN_OUT"]);
  });

  it("LEASE_LANDLORD has the correct stage list", () => {
    expect(PIPELINE_STAGES.LEASE_LANDLORD).toEqual(["LISTING_APPOINTMENT", "ACTIVE_LISTING", "APPLICATION_RECEIVED", "LEASE_SIGNED", "FALLEN_OUT"]);
  });

  it("labels every new stage", () => {
    expect(STAGE_LABELS.SEARCHING).toBe("Searching");
    expect(STAGE_LABELS.APPLICATION_SUBMITTED).toBe("Application Submitted");
    expect(STAGE_LABELS.APPLICATION_RECEIVED).toBe("Application Received");
    expect(STAGE_LABELS.LEASE_SIGNED).toBe("Lease Signed");
  });

  it("isValidStageForPipeline rejects a buyer stage on a lease tenant pipeline", () => {
    expect(isValidStageForPipeline("PRE_APPROVAL", "LEASE_TENANT")).toBe(false);
    expect(isValidStageForPipeline("SEARCHING", "LEASE_TENANT")).toBe(true);
  });
});
