"use client";

import { useState } from "react";

interface Props {
  leads: { id: string; firstName: string; lastName: string }[];
}

export function BrokerageLeadsBanner({ leads: initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState("");

  if (leads.length === 0) return null;

  const MAX_NAMES = 3;
  const shown = leads.slice(0, MAX_NAMES);
  const extra = leads.length - MAX_NAMES;

  const nameList =
    shown.map((l) => `${l.firstName} ${l.lastName}`).join(", ") +
    (extra > 0 ? ` +${extra} more` : "");

  async function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    setError("");
    try {
      const res = await fetch("/api/leads/dismiss-brokerage-assignments", {
        method: "POST",
      });
      if (!res.ok) {
        setError("Failed to dismiss. Please try again.");
        return;
      }
      setLeads([]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="mb-6 flex items-start gap-4 rounded-2xl border border-[#9E8C61]/30 bg-[#9E8C61]/10 px-5 py-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-[#1B1B1B]">
          Ryan assigned you{" "}
          {leads.length === 1 ? "a new" : `${leads.length} new`} brokerage
          lead{leads.length !== 1 ? "s" : ""}:
        </p>
        <p className="mt-0.5 text-sm text-[#1B1B1B]/60">{nameList}</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="shrink-0 rounded-lg border border-[#9E8C61]/40 px-3 py-1.5 text-xs font-medium text-[#1B1B1B] transition-colors hover:bg-[#9E8C61]/20 disabled:opacity-50"
      >
        {dismissing ? "Dismissing..." : "Dismiss"}
      </button>
    </div>
  );
}
