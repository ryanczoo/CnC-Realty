import { XCircle } from "lucide-react";
import { InReviewIcon } from "@/components/ui/InReviewIcon";
import { NotSubmittedIcon } from "@/components/ui/NotSubmittedIcon";
import { CheckCircleIcon } from "@/components/ui/CheckCircleIcon";
import type { DocumentReviewStatus } from "@/types/transaction";

// The review-status icon shown beside a document on the Checklist tab — shared
// by the checklist rows and the Additional Documents list.
export const STATUS_ICONS: Record<DocumentReviewStatus, React.ReactNode> = {
  APPROVED:       <CheckCircleIcon size={16} className="text-green-600" />,
  REJECTED:       <XCircle className="h-4 w-4 text-red-500" />,
  PENDING_REVIEW: <InReviewIcon size={16} className="text-yellow-600" />,
  NOT_SUBMITTED:  <NotSubmittedIcon size={16} className="text-zinc-400" />,
};
