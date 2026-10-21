import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminTable } from "@/components/admin/AdminTable";
import { DocumentsTab } from "@/components/transactions/DocumentsTab";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import type { FileDocumentRecord } from "@/types/transaction";

const doc = (over: Partial<FileDocumentRecord> = {}): FileDocumentRecord => ({
  id: "d1", checklistItemId: null, name: "Pest Inspection Report.pdf", uploadedByAgentId: "u1",
  r2Url: "transactions/listing/l1/d1/Pest Inspection Report.pdf", uploadedAt: "2026-10-21T18:15:12.567Z",
  reviewStatus: "PENDING_REVIEW", rejectionNote: null, isAdditional: true, ...over,
});
const docsTab = (documents: FileDocumentRecord[]) =>
  renderToStaticMarkup(createElement(DocumentsTab, { documents, checklistItems: [] }));
const thead = (html: string) => html.match(/<thead>[\s\S]*?<\/thead>/)![0];

describe("Documents tab", () => {
  it("labels a document added through Additional Documents", () => {
    expect(docsTab([doc()])).toContain(">Additional Document<");
  });

  it("still labels a removed document Unattached", () => {
    expect(docsTab([doc({ isAdditional: false })])).toContain(">Unattached<");
  });

  it("downloads through the document's download route", () => {
    const html = docsTab([doc()]);
    expect(html).toContain('href="/api/documents/d1/download?redirect=1"');
    expect(html).not.toContain('href="transactions/');
  });

  it("header bar is black with white text", () => {
    const head = thead(docsTab([doc()]));
    expect(head).toContain('<tr class="bg-[#1B1B1B]">');
    expect(head).not.toContain("text-[#1B1B1B]/40");
    expect(head.match(/text-white/g)).toHaveLength(5);
  });
});

describe("Parties tab", () => {
  const html = renderToStaticMarkup(
    createElement(PartiesTable, {
      fileType: "listing", fileId: "l1", onChanged: vi.fn(), readOnly: true,
      parties: [{ id: "p1", role: "SELLER", name: "Matt Nguyen", email: "m@x.com", phone: null, company: null, licenseNumber: null } as any],
    }),
  );

  it("header bar is black with white text", () => {
    const head = thead(html);
    expect(head).toContain('<tr class="bg-[#1B1B1B]');
    expect(head).not.toContain("text-[#1B1B1B]/40");
  });

  it("header and body cells are padded like the Documents table", () => {
    expect(thead(html)).toMatch(/<th class="px-5 py-3/);
    expect(html).toMatch(/<td class="px-5 py-2[^"]*">Seller</);
  });
});

describe("AdminTable", () => {
  it("header markup is unchanged", () => {
    expect(renderToStaticMarkup(createElement(AdminTable, { headers: ["Name", "Email"], children: null }))).toBe(
      '<div class="overflow-hidden rounded-2xl bg-white shadow-sm max-lg:overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-[#1B1B1B]"><th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Name</th><th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Email</th></tr></thead><tbody></tbody></table></div>',
    );
  });
});
