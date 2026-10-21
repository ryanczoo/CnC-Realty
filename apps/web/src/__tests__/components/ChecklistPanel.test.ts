import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";
import type { UploadResult } from "@/components/ui/UploadResultLine";

// The hook's per-row results are state a static render can't reach — stub it.
const hook = { uploadingId: null as string | null, results: {} as Record<string, UploadResult>, upload: vi.fn() };
vi.mock("@/hooks/useFileUpload", () => ({ useFileUpload: () => hook }));

import { ChecklistPanel } from "@/components/transactions/ChecklistPanel";

const items = [
  { id: "c1", name: "RLA — Residential Listing Agreement", isRequired: true, documents: [] },
  { id: "c2", name: "NHD — Natural Hazard Disclosure Report", isRequired: true, documents: [{ id: "d2", uploadedByAgentId: "u1", reviewStatus: "PENDING_REVIEW" as const, uploadedAt: "2026-10-21T18:14:47.742Z" }] },
  { id: "c3", name: "TDS", isRequired: false, documents: [{ id: "d3", uploadedByAgentId: "u2", reviewStatus: "REJECTED" as const, uploadedAt: "2026-10-21T18:14:47.742Z", rejectionNote: "Unsigned" }] },
];
const render = () =>
  renderToStaticMarkup(
    createElement(ChecklistPanel, { fileType: "LISTING", fileId: "l1", items, documents: [], onUploaded: () => {}, viewerId: "u1" }),
  );

describe("ChecklistPanel upload results", () => {
  beforeEach(() => { hook.results = {}; });

  it("renders the same markup as before when there is no result", () => {
    const before = readFileSync(join(__dirname, "fixtures/checklist-panel-before.html"), "utf8");
    expect(render()).toBe(before);
  });

  it("shows a failed upload's reason under that checklist row, not at the top", () => {
    hook.results = { c1: { name: "rla.heic", ok: false, error: "File type not allowed. Use PDF, JPG, PNG, or DOCX." } };
    const html = render();
    const rla = html.indexOf("RLA — Residential Listing Agreement");
    const reason = html.indexOf("File type not allowed");
    const nhd = html.indexOf("NHD — Natural Hazard Disclosure Report");
    expect(reason).toBeGreaterThan(rla);
    expect(reason).toBeLessThan(nhd);
    expect(html).toContain("rla.heic");
  });

  it("shows a successful upload's file name with a check under its row", () => {
    hook.results = { c2: { name: "nhd.pdf", ok: true } };
    const html = render();
    const at = html.indexOf("nhd.pdf");
    expect(at).toBeGreaterThan(html.indexOf("NHD — Natural Hazard Disclosure Report"));
    expect(at).toBeLessThan(html.indexOf(">TDS<"));
  });
});
