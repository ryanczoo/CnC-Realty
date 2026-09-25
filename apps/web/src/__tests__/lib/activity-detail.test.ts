import { describe, it, expect } from "vitest";
import { describeActivity, latestCancellationReason } from "@/lib/activity-detail";

describe("describeActivity", () => {
  it("shows the document name for an upload", () => {
    expect(describeActivity({ type: "DOCUMENT_UPLOADED", payload: { documentId: "d1", name: "TDS.pdf" } }))
      .toEqual({ detail: "TDS.pdf", reason: null });
  });

  it("shows the document name for an approval", () => {
    expect(describeActivity({ type: "DOCUMENT_APPROVED", payload: { documentId: "d1", name: "RPA.pdf" } }))
      .toEqual({ detail: "RPA.pdf", reason: null });
  });

  it("shows the document name and the rejection note for a rejection", () => {
    expect(describeActivity({ type: "DOCUMENT_REJECTED", payload: { documentId: "d1", name: "TDS.pdf", note: "Blurry scan" } }))
      .toEqual({ detail: "TDS.pdf", reason: "Blurry scan" });
  });

  it("shows from → to when both statuses are recorded", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { from: "INCOMPLETE", to: "PENDING" } }))
      .toEqual({ detail: "Incomplete → Pending", reason: null });
  });

  it("marks a status change made by the morning job as automatic", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { from: "ACTIVE", to: "EXPIRED", automatic: true } }))
      .toEqual({ detail: "Active → Expired (automatic)", reason: null });
  });

  it("marks a listing change driven by its linked transaction", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { from: "ACTIVE_UNDER_CONTRACT", to: "CLOSED", viaTransactionId: "t1" } }))
      .toEqual({ detail: "Under Contract → Closed (via transaction file)", reason: null });
  });

  it("uses the same readable names as the status badges (e.g. an approved cancellation)", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { from: "INCOMPLETE", to: "CANCELED_APPROVED" } }))
      .toEqual({ detail: "Incomplete → Canceled", reason: null });
  });

  it("shows the agent's reason on a cancellation request", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { from: "PENDING", to: "CANCELED_PENDING", reason: "Financing fell through" } }))
      .toEqual({ detail: "Pending → Cancel Pending", reason: "Financing fell through" });
  });

  it("shows → to when only the new status was recorded", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { to: "CLOSED" } }))
      .toEqual({ detail: "→ Closed", reason: null });
  });

  it("names the document that was removed from the checklist, and which item", () => {
    expect(describeActivity({ type: "DOCUMENT_REMOVED", payload: { name: "RLA.pdf", checklistItemName: "RLA — Residential Listing Agreement" } }))
      .toEqual({ detail: "RLA.pdf (from RLA — Residential Listing Agreement)", reason: null });
  });

  it("names a permanently deleted document and shows the broker's reason", () => {
    expect(describeActivity({ type: "DOCUMENT_DELETED", payload: { name: "Wrong client.pdf", reason: "Another client's paperwork" } }))
      .toEqual({ detail: "Wrong client.pdf", reason: "Another client's paperwork" });
  });

  it("returns nothing extra for other types or a missing payload", () => {
    expect(describeActivity({ type: "SUBMITTED_FOR_REVIEW", payload: null })).toEqual({ detail: null, reason: null });
    expect(describeActivity({ type: "DOCUMENT_APPROVED", payload: null })).toEqual({ detail: null, reason: null });
    expect(describeActivity({ type: "FILE_CREATED", payload: { anything: 1 } })).toEqual({ detail: null, reason: null });
  });

  it("trims stray padding around a document name", () => {
    expect(describeActivity({ type: "DOCUMENT_UPLOADED", payload: { name: "  TDS.pdf  " } }))
      .toEqual({ detail: "TDS.pdf", reason: null });
  });
});

describe("latestCancellationReason", () => {
  const change = (to: string, reason?: string, createdAt = "2026-09-25T10:00:00.000Z") =>
    ({ type: "STATUS_CHANGED", payload: { from: "PENDING", to, ...(reason && { reason }) }, createdAt });

  it("returns the reason from the most recent cancellation request", () => {
    expect(latestCancellationReason([
      change("CANCELED_PENDING", "Old reason", "2026-09-01T10:00:00.000Z"),
      change("PENDING"),
      change("CANCELED_PENDING", "Financing fell through", "2026-09-25T10:00:00.000Z"),
    ])).toBe("Financing fell through");
  });

  it("returns null when there is no reasoned request", () => {
    expect(latestCancellationReason([change("PENDING"), { type: "NOTE_ADDED", payload: null, createdAt: "2026-09-25T10:00:00.000Z" }])).toBeNull();
  });
});
