"use client";
import { useState } from "react";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import type { FileDocumentRecord } from "@/types/transaction";

interface Props {
  document: FileDocumentRecord;
  onReviewed: () => void;
}

export function DocumentReviewCard({ document: doc, onReviewed }: Props) {
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function getDownloadUrl() {
    const { url } = await fetch(`/api/documents/${doc.id}/download`).then((r) => r.json());
    window.open(url, "_blank");
  }

  async function approve() {
    setLoading(true);
    await fetch(`/api/admin/documents/${doc.id}/approve`, { method: "POST" });
    setLoading(false);
    onReviewed();
  }

  async function reject() {
    if (!rejectNote.trim()) return;
    setLoading(true);
    await fetch(`/api/admin/documents/${doc.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: rejectNote }),
    });
    setLoading(false);
    setShowRejectForm(false);
    onReviewed();
  }

  const statusColor = {
    APPROVED: "text-green-600",
    REJECTED: "text-red-500",
    PENDING_REVIEW: "text-yellow-600",
    NOT_SUBMITTED: "text-zinc-400",
  }[doc.reviewStatus];

  return (
    <div className="rounded-lg border border-[#1B1B1B]/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#1B1B1B]">{doc.name}</p>
          <p className="text-xs text-[#1B1B1B]/40">{new Date(doc.uploadedAt).toLocaleString()}</p>
          {doc.rejectionNote && <p className="mt-1 text-xs text-red-500">Note: {doc.rejectionNote}</p>}
        </div>
        <span className={`text-sm font-medium ${statusColor}`}>{doc.reviewStatus.replace("_", " ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={getDownloadUrl} className="flex items-center gap-1 rounded-full border border-[#1B1B1B]/20 px-3 py-1 text-xs text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40">
          <ExternalLink className="h-3 w-3" /> View
        </button>
        {doc.reviewStatus === "PENDING_REVIEW" && (
          <>
            <button onClick={approve} disabled={loading} className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
              <CheckCircle className="h-3 w-3" /> Approve
            </button>
            <button onClick={() => setShowRejectForm((v) => !v)} className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">
              <XCircle className="h-3 w-3" /> Reject
            </button>
          </>
        )}
      </div>

      {showRejectForm && (
        <div className="mt-3 space-y-2">
          <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Rejection reason (required)" rows={2} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowRejectForm(false)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
            <button onClick={reject} disabled={loading || !rejectNote.trim()} className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white disabled:opacity-40">
              {loading ? "Saving…" : "Confirm Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
