"use client";
import { useState } from "react";
import type { FileDocumentRecord } from "@/types/transaction";
import { UploadFileButton } from "./UploadFileButton";
import { DocumentReviewCard } from "./DocumentReviewCard";
import { STATUS_ICONS } from "./document-status-icons";
import { UploadResultLine, type UploadResult } from "@/components/ui/UploadResultLine";
import { removeFromChecklist } from "@/lib/document-actions";
import { TrashIcon } from "@/components/ui/TrashIcon";

interface Props {
  documents: FileDocumentRecord[];
  // agent: name + status icon (+ remove on their own pending upload);
  // admin: the broker's full review card for each.
  mode: "agent" | "admin";
  // From useFileUpload: "additional" is Add Document, "replace:<id>" a rejected line's Upload.
  uploadingId: string | null;
  results: Record<string, UploadResult>;
  disabled: boolean;
  onSelect: (file: File) => void;
  // Upload on a rejected line: the new file takes that line (like a checklist row).
  onReplace: (documentId: string, file: File) => void;
  viewerId?: string;
  onChanged: () => void;
}

// Shared Checklist-tab "Additional Documents" section — the agent ChecklistPanel
// and the admin checklist view. Lists every document added here (isAdditional),
// oldest first, from saved data, so it stays after leaving the tab. Same
// remove-and-rejection rules as checklist rows; a rejected line gets the
// checklist row's Upload button.
export function AdditionalDocuments({ documents, mode, uploadingId, results, disabled, onSelect, onReplace, viewerId, onChanged }: Props) {
  const [removeError, setRemoveError] = useState<string | null>(null);
  const additional = documents
    .filter((d) => d.isAdditional)
    .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

  async function remove(documentId: string) {
    if (!window.confirm("Remove this document from the checklist? It stays in the file's Documents tab.")) return;
    setRemoveError(null);
    const err = await removeFromChecklist(documentId);
    if (err) { setRemoveError(err); return; }
    onChanged();
  }

  const uploadButton = (doc: FileDocumentRecord) => (
    <UploadFileButton
      label="Upload"
      uploading={uploadingId === `replace:${doc.id}`}
      disabled={uploadingId !== null || disabled}
      onSelect={(f) => onReplace(doc.id, f)}
    />
  );

  return (
    <>
      {/* Each page keeps its original spacing: the agent panel's row had mt-4, the admin view's didn't. */}
      <div className={`${mode === "agent" ? "mt-4 " : ""}flex items-center justify-between border-t border-[#1B1B1B]/10 pt-4`}>
        <p className="text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Additional Documents</p>
        <UploadFileButton
          label="Add Document"
          variant="outline"
          uploading={uploadingId === "additional"}
          disabled={uploadingId !== null || disabled}
          onSelect={onSelect}
        />
      </div>
      <UploadResultLine result={results.additional ?? null} />
      {removeError && <p className="text-xs text-red-600">{removeError}</p>}
      {additional.length > 0 && (
        <div className="mt-2 space-y-2">
          {additional.map((doc) =>
            mode === "admin" ? (
              doc.reviewStatus === "REJECTED" ? (
                // Same frame as an admin checklist item: name + Upload, review card below.
                <div key={doc.id} className="rounded-xl border border-[#1B1B1B]/10 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-[#1B1B1B]">{doc.name}</h3>
                    {uploadButton(doc)}
                  </div>
                  <DocumentReviewCard document={doc} onReviewed={onChanged} />
                </div>
              ) : (
                <DocumentReviewCard key={doc.id} document={doc} onReviewed={onChanged} />
              )
            ) : (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white p-3">
                <span className="shrink-0">{STATUS_ICONS[doc.reviewStatus]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1B1B1B]">{doc.name}</p>
                  {doc.reviewStatus === "REJECTED" && (
                    <>
                      <p className="text-xs text-red-500">Rejected — please re-upload</p>
                      {doc.rejectionNote && <p className="text-xs text-red-500">Reason: {doc.rejectionNote}</p>}
                    </>
                  )}
                </div>
                {doc.reviewStatus === "REJECTED" && uploadButton(doc)}
                {viewerId && doc.reviewStatus === "PENDING_REVIEW" && doc.uploadedByAgentId === viewerId && !disabled && (
                  <button
                    onClick={() => remove(doc.id)}
                    title="Remove from checklist"
                    aria-label="Remove from checklist"
                    className="w-[14px] shrink-0 text-[#1B1B1B]/25 hover:text-red-400"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}
