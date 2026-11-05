"use client";
import { useState } from "react";
import { useFileFetch } from "@/components/transactions/AgentViewContext";
import { sanitizeCurrencyInput, formatCurrencyDisplay } from "@/lib/form-validation";
import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";
import type { TransactionFileDetail } from "@/types/transaction";

// mode "agent": the file agent's Successful/Unsuccessful choice. mode "broker":
// the broker's amount box and Mark Closed. The Agent file page renders the first,
// the Admin file page the second.
export function ReferralActions({
  transaction,
  mode,
  viewerIsFileAgent,
  onDone,
}: {
  transaction: TransactionFileDetail;
  mode: "agent" | "broker";
  viewerIsFileAgent: boolean;
  onDone: () => void;
}) {
  const fileFetch = useFileFetch();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    setWarning(false);
    try {
      const res = await fileFetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Failed to update status. Please try again.");
        return;
      }
      const okBody = await res.json().catch(() => null);
      if (okBody?.emailWarning) setWarning(true);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const status = transaction.status;

  let content: React.ReactNode = null;

  if (mode === "agent" && status === "PENDING" && viewerIsFileAgent) {
    content = (
      <>
        <button
          onClick={() => patch({ status: "REFERRAL_SUCCESSFUL" })}
          disabled={submitting}
          className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Referral Successful
        </button>
        <button
          onClick={() => patch({ status: "REFERRAL_UNSUCCESSFUL" })}
          disabled={submitting}
          className="rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B]/70 hover:border-[#1B1B1B]/40 disabled:opacity-50"
        >
          Referral Unsuccessful
        </button>
      </>
    );
  } else if (mode === "broker" && status === "REFERRAL_SUCCESSFUL") {
    content = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!amount.trim()) return;
          patch({ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: amount });
        }}
        className="flex items-center gap-2 max-lg:flex-col max-lg:items-stretch"
      >
        <input
          type="text"
          inputMode="decimal"
          required
          placeholder="Amount received"
          value={formatCurrencyDisplay(amount)}
          onChange={(e) => setAmount(sanitizeCurrencyInput(e.target.value, 12))}
          className="w-40 rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40 max-lg:w-full"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Submit for Broker Review
        </button>
      </form>
    );
  } else if (mode === "broker" && (status === "REFERRAL_BROKER_REVIEW" || status === "REFERRAL_UNSUCCESSFUL")) {
    content = (
      <button
        onClick={() => patch({ status: "CLOSED" })}
        disabled={submitting}
        className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Mark Closed
      </button>
    );
  }

  if (!content && !warning) return null;

  return (
    <div className="flex flex-col items-end gap-1.5 max-lg:items-stretch">
      {content && <div className="flex items-center gap-2 max-lg:flex-col max-lg:items-stretch">{content}</div>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {warning && <p className="mt-2 text-xs text-amber-700">{EMAIL_WARNING_TEXT}</p>}
    </div>
  );
}
