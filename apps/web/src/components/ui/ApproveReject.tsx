"use client";
import { useState } from "react";
import { XCircle } from "lucide-react";
import { CheckCircleIcon } from "@/components/ui/CheckCircleIcon";

// Green Approve + red Reject pills, rendered as a fragment so the caller's
// flex row keeps its own gap. Used wherever a broker reviews something.
export function ApproveRejectButtons({
  busy,
  onApprove,
  onToggleReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onToggleReject: () => void;
}) {
  return (
    <>
      <button onClick={onApprove} disabled={busy} className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
        <CheckCircleIcon size={12} /> Approve
      </button>
      <button onClick={onToggleReject} className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">
        <XCircle className="h-3 w-3" /> Reject
      </button>
    </>
  );
}

// The reason box shown after Reject. Owns the typed reason; the caller decides
// what Confirm does.
export function RejectReasonForm({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rejection reason (required)" rows={2} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-sm text-[#1B1B1B]/50">Cancel</button>
        <button onClick={() => onConfirm(reason)} disabled={busy || !reason.trim()} className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white disabled:opacity-40">
          {busy ? "Saving…" : "Confirm Reject"}
        </button>
      </div>
    </div>
  );
}
