import { describe, it, expect } from "vitest";
import {
  commissionFields,
  buildPendingCommission,
  isAfterReview,
  canClearReview,
  hasPendingCommission,
} from "@/lib/commission-review";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

const item = (isRequired: boolean, status: "APPROVED" | "PENDING" | null): FileChecklistItemWithDocs =>
  ({
    id: "i", name: "RPA", isRequired,
    documents: status ? [{ reviewStatus: status }] : [],
  }) as unknown as FileChecklistItemWithDocs;

describe("commissionFields", () => {
  it("lists the listing commission fields", () => {
    expect(commissionFields("listing")).toEqual(["commissionPercent", "commissionAmount"]);
  });
  it("lists the four transaction commission fields", () => {
    expect(commissionFields("transaction")).toEqual([
      "saleCommissionPct", "saleCommissionAmount", "listingCommissionPct", "listingCommissionAmount",
    ]);
  });
});

describe("buildPendingCommission", () => {
  it("keeps only commission fields, fills missing with null, stamps requestedAt", () => {
    const changes = [{ label: "Commission", from: "2.5%", to: "2%" }];
    expect(
      buildPendingCommission(
        "listing",
        { commissionPercent: 2.5, commissionAmount: null, city: "X" },
        changes,
        new Date("2026-11-04T00:00:00Z"),
      ),
    ).toEqual({
      before: { commissionPercent: 2.5, commissionAmount: null },
      changes,
      requestedAt: "2026-11-04T00:00:00.000Z",
    });
  });
  it("fills missing keys with null", () => {
    const p = buildPendingCommission("listing", { commissionPercent: 3 }, [], new Date(0));
    expect(p.before).toEqual({ commissionPercent: 3, commissionAmount: null });
  });
});

describe("isAfterReview", () => {
  const d = new Date("2026-11-04T00:00:00Z");
  it("false when never submitted", () => {
    expect(isAfterReview({ reviewSubmittedAt: null })).toBe(false);
  });
  it("false while still awaiting review", () => {
    expect(isAfterReview({ reviewSubmittedAt: d, awaitingReview: true })).toBe(false);
  });
  it("true once submitted and review cleared", () => {
    expect(isAfterReview({ reviewSubmittedAt: d, awaitingReview: false })).toBe(true);
  });
});

const REAL_PENDING = {
  before: { commissionPercent: 2.5, commissionAmount: null },
  changes: [{ label: "Commission", from: "2.5%", to: "2%" }],
  requestedAt: "2026-10-02T00:00:00.000Z",
};

describe("hasPendingCommission", () => {
  it("is false for null, undefined, {}, and an empty changes list", () => {
    expect(hasPendingCommission(null)).toBe(false);
    expect(hasPendingCommission(undefined)).toBe(false);
    expect(hasPendingCommission({})).toBe(false);
    expect(hasPendingCommission({ changes: [] })).toBe(false);
  });
  it("is true for a real pending commission", () => {
    expect(hasPendingCommission(REAL_PENDING)).toBe(true);
  });
});

describe("canClearReview", () => {
  const approved = [item(true, "APPROVED"), item(false, null)];
  it("true when ready to close and no pending commission", () => {
    expect(canClearReview(approved, null)).toBe(true);
  });
  it("false while a commission change is pending", () => {
    expect(canClearReview(approved, REAL_PENDING)).toBe(false);
  });
  it("true when the stored value is not a real pending change", () => {
    expect(canClearReview(approved, {})).toBe(true);
  });
  it("false when a required item is not approved", () => {
    expect(canClearReview([item(true, "PENDING")], null)).toBe(false);
  });
});
