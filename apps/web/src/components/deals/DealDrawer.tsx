"use client";

import { useState, useEffect } from "react";
import { STAGE_LABELS, PIPELINE_STAGES, isTerminalStage } from "@/lib/deal-pipeline";
import type { DealRow } from "@/lib/deal-pipeline";
import type { DealStage } from "@cnc/database";
import { DateField } from "@/components/ui/DateField";

type Props = {
  open: boolean;
  deal: DealRow | null;
  onClose: () => void;
  onSaved: (deal: DealRow) => void;
  onDeleted: (dealId: string) => void;
  onConverted: (transactionFileId: string) => void;
};

export function DealDrawer({ open, deal, onClose, onSaved, onDeleted, onConverted }: Props) {
  const [stage, setStage] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [price, setPrice] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConvertPrompt, setShowConvertPrompt] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (deal) {
      setStage(deal.stage);
      setPropertyAddress(deal.propertyAddress ?? "");
      setPrice(deal.price != null ? String(deal.price) : "");
      setExpectedCloseDate(
        deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : ""
      );
      setNotes(deal.notes ?? "");
      setError(null);
      setShowConvertPrompt(false);
    }
  }, [deal]);

  async function handleSave() {
    if (!deal) return;
    setSaving(true);
    setError(null);

    const prevStage = deal.stage;
    const body: Record<string, unknown> = {
      stage,
      propertyAddress: propertyAddress || null,
      price: price ? Number(price) : null,
      expectedCloseDate: expectedCloseDate || null,
      notes: notes || null,
    };

    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save");
      return;
    }

    const updated: DealRow = await res.json();
    onSaved(updated);

    if (isTerminalStage(deal.pipeline, stage as DealStage) && !isTerminalStage(deal.pipeline, prevStage)) {
      setShowConvertPrompt(true);
    } else {
      onClose();
    }
  }

  async function handleConvert() {
    if (!deal) return;
    setConverting(true);

    const res = await fetch(`/api/deals/${deal.id}/convert`, { method: "POST" });
    setConverting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Conversion failed");
      return;
    }

    const data = await res.json();
    onConverted(data.transactionFileId);
  }

  async function handleDelete() {
    if (!deal) return;
    if (!window.confirm("Delete this deal? This cannot be undone.")) return;

    const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(deal.id);
  }

  const stagesForPipeline = deal ? PIPELINE_STAGES[deal.pipeline] : [];
  const hasLinkedFile = !!deal?.transactionFileId;

  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "hidden"}`}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-medium text-[#1B1B1B]">
            {deal?.leadName ?? "Deal"}
          </h2>
          <button onClick={onClose} className="font-sans text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
            ✕
          </button>
        </div>

        {deal && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2 font-sans text-sm text-red-600">{error}</p>
            )}

            {showConvertPrompt && !hasLinkedFile && (
              <div className="rounded-xl border border-[#9E8C61]/30 bg-[#9E8C61]/5 p-4">
                <p className="mb-3 font-sans text-sm text-[#1B1B1B]">
                  {STAGE_LABELS[deal.stage as keyof typeof STAGE_LABELS]}! Ready to open a Transaction File?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConvert}
                    disabled={converting}
                    className="rounded-lg bg-[#9E8C61] px-4 py-2 font-sans text-sm font-medium text-white hover:bg-[#8a7a55] disabled:opacity-50"
                  >
                    {converting ? "Creating…" : "Create Transaction File"}
                  </button>
                  <button
                    onClick={() => { setShowConvertPrompt(false); onClose(); }}
                    className="rounded-lg border border-[#1B1B1B]/20 px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}

            {isTerminalStage(deal.pipeline, deal.stage) && !hasLinkedFile && !showConvertPrompt && (
              <button
                onClick={handleConvert}
                disabled={converting}
                className="w-full rounded-lg border border-[#9E8C61]/40 bg-[#9E8C61]/5 px-4 py-2 font-sans text-sm font-medium text-[#9E8C61] hover:bg-[#9E8C61]/10 disabled:opacity-50"
              >
                {converting ? "Creating…" : "Create Transaction File"}
              </button>
            )}

            {hasLinkedFile && (
              <a
                href={`/dashboard/transactions/transaction/${deal.transactionFileId}`}
                className="block text-center font-sans text-sm text-[#9E8C61] underline"
              >
                View Transaction File →
              </a>
            )}

            <div>
              <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/20 bg-[#F2F0EF] px-3 py-2 font-sans text-sm text-[#1B1B1B]"
              >
                {stagesForPipeline.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s as keyof typeof STAGE_LABELS]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Property Address</label>
              <input
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-[#1B1B1B]/20 bg-[#F2F0EF] px-3 py-2 font-sans text-sm text-[#1B1B1B]"
              />
            </div>

            <div>
              <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Price</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-[#1B1B1B]/20 bg-[#F2F0EF] px-3 py-2 font-sans text-sm text-[#1B1B1B]"
              />
            </div>

            <div>
              <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Expected Close Date</label>
              <DateField value={expectedCloseDate} onChange={setExpectedCloseDate} />
            </div>

            <div>
              <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Track offer details, counter-offers, listing updates…"
                className="w-full rounded-lg border border-[#1B1B1B]/20 bg-[#F2F0EF] px-3 py-2 font-sans text-sm text-[#1B1B1B]"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#1B1B1B]/10 px-6 py-4">
          <button
            onClick={handleDelete}
            className="font-sans text-sm text-red-500 hover:text-red-600"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[#1B1B1B]/20 px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#1B1B1B] px-4 py-2 font-sans text-sm font-medium text-white hover:bg-[#1B1B1B]/80 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
