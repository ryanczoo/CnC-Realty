"use client";
import { useRef, useState } from "react";
import { CheckCircle, XCircle, Clock, Upload, AlertCircle } from "lucide-react";
import type { FileChecklistItemWithDocs, DocumentReviewStatus } from "@/types/transaction";
import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { latestDocument } from "@/lib/transaction-helpers";

interface Props {
  fileType: "LISTING" | "TRANSACTION";
  fileId: string;
  items: FileChecklistItemWithDocs[];
  onUploaded: () => void;
  readOnly?: boolean;
}

const STATUS_ICONS: Record<DocumentReviewStatus, React.ReactNode> = {
  APPROVED:       <CheckCircle className="h-4 w-4 text-green-600" />,
  REJECTED:       <XCircle className="h-4 w-4 text-red-500" />,
  PENDING_REVIEW: <Clock className="h-4 w-4 text-yellow-600" />,
  NOT_SUBMITTED:  <AlertCircle className="h-4 w-4 text-zinc-400" />,
};

export function ChecklistPanel({ fileType, fileId, items, onUploaded, readOnly = false }: Props) {
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(itemId: string | null, file: File) {
    setUploadingItemId(itemId ?? "additional");
    setError(null);

    try {
      const params = new URLSearchParams({
        fileType: fileType === "LISTING" ? "listing" : "transaction",
        fileId,
        filename: file.name,
        contentType: file.type,
        size: String(file.size),
      });
      const { uploadUrl, key, documentId } = await fetch(`/api/upload-url?${params}`).then((r) => r.json());

      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType, fileId, checklistItemId: itemId, name: file.name, r2Key: key, r2Url: key, documentId }),
      });
      if (!res.ok) throw new Error("Upload failed");

      onUploaded();
    } catch {
      setError("Couldn't upload that file. Please try again.");
    } finally {
      setUploadingItemId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {items.map((item) => {
        const topDoc = latestDocument(item.documents);
        const status: DocumentReviewStatus = topDoc?.reviewStatus ?? "NOT_SUBMITTED";

        return (
          <Tooltip
            key={item.id}
            text="Pending Broker Review"
            disabled={status !== "PENDING_REVIEW"}
            className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white p-3"
          >
            <span className="shrink-0">{STATUS_ICONS[status]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#1B1B1B]">
                {item.name}
                {item.isRequired && <span className="ml-1 text-red-500">*</span>}
              </p>
              {status === "REJECTED" && (
                <>
                  <p className="text-xs text-red-500">Rejected — please re-upload</p>
                  {topDoc?.rejectionNote && <p className="text-xs text-red-500">Reason: {topDoc.rejectionNote}</p>}
                </>
              )}
            </div>
            <label className={`${readOnly ? "pointer-events-none opacity-40 " : ""}shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${uploadingItemId === item.id ? "bg-zinc-100 text-zinc-400" : "bg-[#1B1B1B] text-white hover:bg-[#1B1B1B]/80"}`}>
              {uploadingItemId === item.id ? <><Spinner className="mr-1 inline h-3 w-3" />Uploading…</> : <><Upload className="mr-1 inline h-3 w-3" />Upload</>}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                disabled={uploadingItemId !== null || readOnly}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(item.id, f); }}
              />
            </label>
          </Tooltip>
        );
      })}

      <div className="mt-4 border-t border-[#1B1B1B]/10 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Additional Documents</p>
        <label className={`cursor-pointer rounded-full border border-[#1B1B1B]/20 px-3 py-1.5 text-xs font-medium text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B] ${uploadingItemId !== null ? "opacity-50" : ""} ${readOnly ? "pointer-events-none opacity-40" : ""}`}>
          {uploadingItemId === "additional" ? <><Spinner className="mr-1 inline h-3 w-3" />Uploading…</> : <><Upload className="mr-1 inline h-3 w-3" />Add Document</>}
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx" disabled={uploadingItemId !== null || readOnly} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(null, f); }} />
        </label>
      </div>
    </div>
  );
}
