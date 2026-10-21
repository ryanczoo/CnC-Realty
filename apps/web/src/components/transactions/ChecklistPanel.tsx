"use client";
import { Fragment, useState } from "react";
import type { FileChecklistItemWithDocs, DocumentReviewStatus, FileDocumentRecord } from "@/types/transaction";
import { Tooltip } from "@/components/ui/Tooltip";
import { UploadFileButton } from "./UploadFileButton";
import { useFileUpload } from "@/hooks/useFileUpload";
import { latestDocument } from "@/lib/transaction-helpers";
import { removeFromChecklist } from "@/lib/document-actions";
import { TrashIcon } from "@/components/ui/TrashIcon";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { UploadResultLine } from "@/components/ui/UploadResultLine";
import { STATUS_ICONS } from "./document-status-icons";
import { AdditionalDocuments } from "./AdditionalDocuments";

interface Props {
  fileType: "LISTING" | "TRANSACTION";
  fileId: string;
  items: FileChecklistItemWithDocs[];
  // Every document on the file; the Additional Documents section lists its own.
  documents: FileDocumentRecord[];
  onUploaded: () => void;
  readOnly?: boolean;
  // The signed-in user: an agent may remove only their own In Review upload.
  viewerId?: string;
}


export function ChecklistPanel({ fileType, fileId, items, documents, onUploaded, readOnly = false, viewerId }: Props) {
  const { uploadingId, results, upload } = useFileUpload(fileType, fileId, onUploaded);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function remove(documentId: string) {
    if (!window.confirm("Remove this document from the checklist? It stays in the file's Documents tab.")) return;
    setRemoveError(null);
    const err = await removeFromChecklist(documentId);
    if (err) { setRemoveError(err); return; }
    onUploaded();
  }

  return (
    <div className="space-y-2">
      {removeError && <p className="text-xs text-red-600">{removeError}</p>}
      {items.map((item) => {
        const topDoc = latestDocument(item.documents);
        const status: DocumentReviewStatus = topDoc?.reviewStatus ?? "NOT_SUBMITTED";

        return (
          <Fragment key={item.id}>
            <Tooltip
              text="Pending Broker Review"
              disabled={status !== "PENDING_REVIEW"}
              className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white p-3"
            >
              <span className="shrink-0">{STATUS_ICONS[status]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1B1B1B]">
                  {item.name}
                  {item.isRequired && <RequiredMark />}
                </p>
                {status === "REJECTED" && (
                  <>
                    <p className="text-xs text-red-500">Rejected — please re-upload</p>
                    {topDoc?.rejectionNote && <p className="text-xs text-red-500">Reason: {topDoc.rejectionNote}</p>}
                  </>
                )}
              </div>
              <UploadFileButton
                label="Upload"
                uploading={uploadingId === item.id}
                disabled={uploadingId !== null || readOnly}
                onSelect={(f) => upload(item.id, f)}
              />
              {/* Right of Upload. Rows without a trash icon keep the same slot so the
                  Upload buttons stay in one column. */}
              {topDoc?.id && viewerId && status === "PENDING_REVIEW" && topDoc.uploadedByAgentId === viewerId && !readOnly ? (
                <button
                  onClick={() => remove(topDoc.id!)}
                  title="Remove from checklist"
                  aria-label="Remove from checklist"
                  className="w-[14px] shrink-0 text-[#1B1B1B]/25 hover:text-red-400"
                >
                  <TrashIcon size={14} />
                </button>
              ) : viewerId && !readOnly ? (
                <span aria-hidden="true" className="w-[14px] shrink-0" />
              ) : null}
            </Tooltip>
            <UploadResultLine result={results[item.id] ?? null} />
          </Fragment>
        );
      })}

      <AdditionalDocuments
        documents={documents}
        mode="agent"
        uploading={uploadingId === "additional"}
        disabled={uploadingId !== null || readOnly}
        result={results.additional ?? null}
        onSelect={(f) => upload(null, f)}
        viewerId={viewerId}
        onChanged={onUploaded}
      />
    </div>
  );
}
