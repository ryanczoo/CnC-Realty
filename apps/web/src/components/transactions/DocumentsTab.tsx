import type { FileDocumentRecord, FileChecklistItemWithDocs } from "@/types/transaction";

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
  NOT_SUBMITTED: "bg-[#F2F0EF] text-[#1B1B1B]/50",
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING_REVIEW: "Pending Review",
  NOT_SUBMITTED: "Not Submitted",
};

// Shared Documents tab — the flat list of every uploaded document across the
// file, regardless of which checklist item it's attached to. Renders
// identically for agent and admin viewers of the same file.
export function DocumentsTab({
  documents,
  checklistItems,
}: {
  documents: FileDocumentRecord[];
  checklistItems: FileChecklistItemWithDocs[];
}) {
  const itemMap = new Map(checklistItems.map((ci) => [ci.id, ci.name]));

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1B1B1B]/15 bg-white p-10 text-center">
        <p className="text-sm text-[#1B1B1B]/40">No documents uploaded yet.</p>
        <p className="mt-1 text-xs text-[#1B1B1B]/30">Go to the Checklist tab to upload documents.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/5 bg-[#F2F0EF]/60">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Document</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Checklist Item</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Status</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Uploaded</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Download</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1B1B]/5">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-[#F2F0EF]/30 transition-colors">
              <td className="px-5 py-3 font-medium text-[#1B1B1B]">{doc.name}</td>
              <td className="px-5 py-3 text-[#1B1B1B]/50">
                {doc.checklistItemId ? (itemMap.get(doc.checklistItemId) ?? "—") : "Unattached"}
              </td>
              <td className="px-5 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.reviewStatus] ?? ""}`}>
                  {STATUS_LABELS[doc.reviewStatus] ?? doc.reviewStatus}
                </span>
              </td>
              <td className="px-5 py-3 text-[#1B1B1B]/50">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
              <td className="px-5 py-3 text-right">
                <a
                  href={doc.r2Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9E8C61] hover:underline"
                >
                  Download ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
