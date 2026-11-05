"use client";
import { useState } from "react";
import { ApproveRejectButtons, RejectReasonForm } from "@/components/ui/ApproveReject";
import { REVIEW_WAIT_MESSAGE } from "@/lib/file-lock";
import type { PendingCommission } from "@/lib/commission-review";

// The small block under a file's commission rows on the Overview. Shared by
// the agent and broker pages: both see the pending change lines; the broker
// (onReview given) gets Approve / Reject, the agent just waits.
export function CommissionReviewBlock({
  pendingCommission,
  reviewWait,
  onReview,
}: {
  pendingCommission?: PendingCommission | null;
  reviewWait?: boolean;
  onReview?: (decision: { approve: true } | { approve: false; reason: string }) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingCommission && !reviewWait) return null;

  async function run(decision: { approve: true } | { approve: false; reason: string }) {
    if (!onReview) return;
    setBusy(true);
    setError(null);
    try {
      const err = await onReview(decision);
      if (err) setError(err);
      else setRejecting(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5 border-t border-[#1B1B1B]/5 pt-3">
      {pendingCommission?.changes?.map((c) => (
        <p key={c.label} className="text-sm text-[#1B1B1B]/70">{c.label}: {c.from} → {c.to}</p>
      ))}
      {pendingCommission && onReview && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <ApproveRejectButtons busy={busy} onApprove={() => run({ approve: true })} onToggleReject={() => setRejecting((v) => !v)} />
          </div>
          {rejecting && (
            <RejectReasonForm busy={busy} onCancel={() => setRejecting(false)} onConfirm={(reason) => run({ approve: false, reason })} />
          )}
        </>
      )}
      {reviewWait && !onReview && <p className="text-xs text-[#1B1B1B]/50">{REVIEW_WAIT_MESSAGE}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
