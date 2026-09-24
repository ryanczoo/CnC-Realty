"use client";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import type { FileChecklistItemWithDocs, DocumentReviewStatus } from "@/types/transaction";
import { Tooltip } from "@/components/ui/Tooltip";
import { UploadFileButton } from "./UploadFileButton";
import { useFileUpload } from "@/hooks/useFileUpload";
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
  const { uploadingId, error, upload } = useFileUpload(fileType, fileId, onUploaded);

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
            <UploadFileButton
              label="Upload"
              uploading={uploadingId === item.id}
              disabled={uploadingId !== null || readOnly}
              onSelect={(f) => upload(item.id, f)}
            />
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
