"use client";
import { useState } from "react";
import { XCircle } from "lucide-react";
import { InReviewIcon } from "@/components/ui/InReviewIcon";
import { NotSubmittedIcon } from "@/components/ui/NotSubmittedIcon";
import { CheckCircleIcon } from "@/components/ui/CheckCircleIcon";
import type { FileChecklistItemWithDocs, DocumentReviewStatus } from "@/types/transaction";
import { Tooltip } from "@/components/ui/Tooltip";
import { UploadFileButton } from "./UploadFileButton";
import { useFileUpload } from "@/hooks/useFileUpload";
import { latestDocument } from "@/lib/transaction-helpers";
import { removeFromChecklist } from "@/lib/document-actions";
import { TrashIcon } from "@/components/ui/TrashIcon";

interface Props {
  fileType: "LISTING" | "TRANSACTION";
  fileId: string;
  items: FileChecklistItemWithDocs[];
  onUploaded: () => void;
  readOnly?: boolean;
  // The signed-in user: an agent may remove only their own In Review upload.
  viewerId?: string;
}

const STATUS_ICONS: Record<DocumentReviewStatus, React.ReactNode> = {
  APPROVED:       <CheckCircleIcon size={16} className="text-green-600" />,
  REJECTED:       <XCircle className="h-4 w-4 text-red-500" />,
  PENDING_REVIEW: <InReviewIcon size={16} className="text-yellow-600" />,
  NOT_SUBMITTED:  <NotSubmittedIcon size={16} className="text-zinc-400" />,
};

export function ChecklistPanel({ fileType, fileId, items, onUploaded, readOnly = false, viewerId }: Props) {
  const { uploadingId, error, upload } = useFileUpload(fileType, fileId, onUploaded);
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
      {(error || removeError) && <p className="text-xs text-red-600">{error ?? removeError}</p>}
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
        );
      })}

      <div className="mt-4 flex items-center justify-between border-t border-[#1B1B1B]/10 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Additional Documents</p>
        <UploadFileButton
          label="Add Document"
          variant="outline"
          uploading={uploadingId === "additional"}
          disabled={uploadingId !== null || readOnly}
          onSelect={(f) => upload(null, f)}
        />
      </div>
    </div>
  );
}
