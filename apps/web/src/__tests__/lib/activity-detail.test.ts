import { describe, it, expect } from "vitest";
import { describeActivity } from "@/lib/activity-detail";

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
