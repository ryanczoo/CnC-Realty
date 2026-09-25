"use client";
import { Fragment, useState } from "react";
import type { FileDocumentRecord, FileChecklistItemWithDocs } from "@/types/transaction";
import { TrashIcon } from "@/components/ui/TrashIcon";
import { DownloadIcon } from "@/components/ui/DownloadIcon";
import { deleteDocumentPermanently } from "@/lib/document-actions";

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
// file, regardless of which checklist item it's attached to. Identical for
// agent and admin viewers, except canDelete (admin page only) adds the
// broker's permanent Delete, which asks for a reason inline — the same pattern
// as Reject on DocumentReviewCard.
export function DocumentsTab({
  documents,
  checklistItems,
  canDelete = false,
  onChanged,
}: {
  documents: FileDocumentRecord[];
  checklistItems: FileChecklistItemWithDocs[];
  canDelete?: boolean;
  onChanged?: () => void;
}) {
  const itemMap = new Map(checklistItems.map((ci) => [ci.id, ci.name]));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDelete(id: string) {
    setDeletingId((current) => (current === id ? null : id));
    setReason("");
    setError(null);
  }

  async function confirmDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      const err = await deleteDocumentPermanently(id, reason);
      if (err) { setError(err); return; }
      setDeletingId(null);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1B1B1B]/15 bg-white p-10 text-center">
        <p className="text-sm text-[#1B1B1B]/40">No documents uploaded yet.</p>
        <p className="mt-1 text-xs text-[#1B1B1B]/30">Go to the Checklist tab to upload documents.</p>
      </div>
    );
  }

  const columns = canDelete ? 6 : 5;

  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/5 bg-[#F2F0EF]/60">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Document</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Checklist Item</th>
            <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Status</th>
            <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Uploaded</th>
            <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Download</th>
            {canDelete && <th className="w-12 px-5 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1B1B]/5">
          {documents.map((doc) => (
            <Fragment key={doc.id}>
              <tr className="hover:bg-[#F2F0EF]/30 transition-colors">
                <td className="px-5 py-3 font-medium text-[#1B1B1B]">{doc.name}</td>
                <td className="px-5 py-3 text-[#1B1B1B]/50">
                  {doc.checklistItemId ? (itemMap.get(doc.checklistItemId) ?? "—") : "Unattached"}
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.reviewStatus] ?? ""}`}>
                    {STATUS_LABELS[doc.reviewStatus] ?? doc.reviewStatus}
                  </span>
                </td>
                <td className="px-5 py-3 text-center text-[#1B1B1B]/50">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-center">
                  <a
                    href={doc.r2Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download"
                    aria-label={`Download ${doc.name}`}
                    className="inline-flex text-[#9E8C61] hover:text-[#7a6d4a]"
                  >
                    <DownloadIcon size={18} />
                  </a>
                </td>
                {canDelete && (
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openDelete(doc.id)}
                      title="Delete permanently"
                      aria-label="Delete permanently"
                      className="text-[#1B1B1B]/25 hover:text-red-400"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </td>
                )}
              </tr>
              {canDelete && deletingId === doc.id && (
                <tr>
                  <td colSpan={columns} className="bg-red-50/40 px-5 py-4">
                    <p className="text-xs text-[#1B1B1B]/70">
                      Permanently erases <span className="font-medium">{doc.name}</span>. It can&apos;t be undone.
                      California requires keeping file documents for 3 years (B&amp;P §10148) — only delete a document
                      that doesn&apos;t belong in this file. To take it off a checklist item instead, use Remove on the Checklist tab.
                    </p>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for deleting (required)"
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25"
                    />
                    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setDeletingId(null)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
                      <button
                        onClick={() => confirmDelete(doc.id)}
                        disabled={saving || !reason.trim()}
                        className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white disabled:opacity-40"
                      >
                        {saving ? "Deleting…" : "Delete permanently"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
