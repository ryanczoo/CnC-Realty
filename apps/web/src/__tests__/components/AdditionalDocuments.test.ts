import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdditionalDocuments } from "@/components/transactions/AdditionalDocuments";
import type { FileDocumentRecord } from "@/types/transaction";

const doc = (over: Partial<FileDocumentRecord> = {}): FileDocumentRecord => ({
  id: "d1", checklistItemId: null, name: "Pest Inspection Report.pdf", uploadedByAgentId: "u1",
  r2Url: "k", uploadedAt: "2026-10-21T18:15:12.567Z", reviewStatus: "PENDING_REVIEW",
  rejectionNote: null, isAdditional: true, ...over,
});
const render = (over: Partial<Parameters<typeof AdditionalDocuments>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(AdditionalDocuments, {
      documents: [doc()], mode: "agent", uploadingId: null, results: {}, disabled: false,
      onSelect: vi.fn(), onReplace: vi.fn(), viewerId: "u1", onChanged: vi.fn(), ...over,
    }),
  );

describe("AdditionalDocuments", () => {
  it("lists only additional documents", () => {
    const html = render({ documents: [doc(), doc({ id: "d2", name: "old-nhd.pdf", isAdditional: false })] });
    expect(html).toContain("Pest Inspection Report.pdf");
    expect(html).not.toContain("old-nhd.pdf");
  });

  it("agent sees the rejection reason under a rejected additional document", () => {
    const html = render({ documents: [doc({ reviewStatus: "REJECTED", rejectionNote: "Wrong property" })] });
    expect(html).toContain("Rejected — please re-upload");
    expect(html).toContain("Reason: Wrong property");
  });

  it("agent sees a remove button only on their own pending upload", () => {
    expect(render()).toContain('aria-label="Remove from checklist"');
    expect(render({ viewerId: "u2" })).not.toContain('aria-label="Remove from checklist"');
    expect(render({ documents: [doc({ reviewStatus: "APPROVED" })] })).not.toContain('aria-label="Remove from checklist"');
  });

  it("admin gets the broker review card with Approve and Reject", () => {
    const html = render({ mode: "admin", viewerId: undefined });
    expect(html).toContain("Pest Inspection Report.pdf");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });

  it("shows the last upload result under the heading", () => {
    const html = render({ results: { additional: { name: "survey.pdf", ok: false, error: "File exceeds 50MB limit" } } });
    expect(html.indexOf("File exceeds 50MB limit")).toBeGreaterThan(html.indexOf("Additional Documents"));
    expect(html.indexOf("File exceeds 50MB limit")).toBeLessThan(html.indexOf("Pest Inspection Report.pdf"));
  });

  it("admin gets Remove on an additional document's review card", () => {
    expect(render({ mode: "admin", viewerId: undefined })).toMatch(/>Remove</);
  });

  it("agent gets an Upload button on a rejected additional document, styled like a checklist row's", () => {
    const html = render({ documents: [doc({ reviewStatus: "REJECTED", rejectionNote: "Wrong property" })] });
    // The checklist row's solid black pill (UploadFileButton variant "solid").
    expect(html).toContain("shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors bg-[#1B1B1B] text-white");
    expect(html).toContain("</svg>Upload<");
  });

  it("no Upload button on a pending or approved additional document", () => {
    expect(render()).not.toContain("</svg>Upload<");
    expect(render({ documents: [doc({ reviewStatus: "APPROVED" })] })).not.toContain("</svg>Upload<");
  });

  it("broker also gets Upload on a rejected additional document, above its review card", () => {
    const html = render({ mode: "admin", viewerId: undefined, documents: [doc({ reviewStatus: "REJECTED" })] });
    expect(html).toContain("</svg>Upload<");
    // The review card is still there below it (a rejected one offers Remove, not Approve/Reject).
    expect(html.indexOf(">Remove<")).toBeGreaterThan(html.indexOf("</svg>Upload<"));
  });
});
