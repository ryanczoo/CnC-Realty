"use client";

import { useState, useEffect, useRef } from "react";
import type { DealRow } from "@/lib/deal-pipeline";
import { DateField } from "@/components/ui/DateField";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (deal: DealRow) => void;
  initialLeadId?: string;
  initialLeadName?: string;
  initialPipeline?: "BUYERS" | "SELLERS";
};

type LeadOption = { id: string; name: string };

export function NewDealModal({ open, onClose, onSaved, initialLeadId, initialLeadName, initialPipeline }: Props) {
  const [leadQuery, setLeadQuery] = useState(initialLeadName ?? "");
  const [leadId, setLeadId] = useState(initialLeadId ?? "");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pipeline, setPipeline] = useState<"BUYERS" | "SELLERS">(initialPipeline ?? "BUYERS");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [price, setPrice] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLeadQuery(initialLeadName ?? "");
    setLeadId(initialLeadId ?? "");
    setPipeline(initialPipeline ?? "BUYERS");
    setPropertyAddress("");
    setPrice("");
    setExpectedCloseDate("");
    setError(null);
    setLeadOptions([]);
    setShowDropdown(false);
  }, [open, initialLeadId, initialLeadName, initialPipeline]);

  function onLeadSearch(q: string) {
    setLeadQuery(q);
    setLeadId("");
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!q.trim()) { setLeadOptions([]); setShowDropdown(false); return; }
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/leads?search=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      const leads = Array.isArray(data) ? data : data.leads ?? [];
      setLeadOptions(leads.map((l: { id: string; firstName: string; lastName: string }) => ({ id: l.id, name: `${l.firstName} ${l.lastName}` })));
      setShowDropdown(true);
    }, 250);
  }

  async function handleSave() {
    if (!leadId) { setError("Please select a lead"); return; }
    setSaving(true);
    setError(null);

    const firstStage = pipeline === "BUYERS" ? "PRE_APPROVAL" : "LISTING_APPOINTMENT";

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        pipeline,
        stage: firstStage,
        propertyAddress: propertyAddress || null,
        price: price ? Number(price) : null,
        expectedCloseDate: expectedCloseDate || null,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create deal");
      return;
    }

    const deal: DealRow = await res.json();
    onSaved(deal);
    onClose();
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? "" : "hidden"}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-sans text-lg font-medium text-[#1B1B1B]">New Deal</h2>
          <button onClick={onClose} className="font-sans text-[#1B1B1B]/40 hover:text-[#1B1B1B]">✕</button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 font-sans text-sm text-red-600">{error}</p>
        )}

        <div className="space-y-4">
          <div className="relative">
            <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Lead *</label>
            <input
              value={leadQuery}
              onChange={(e) => onLeadSearch(e.target.value)}
              placeholder="Search by name…"
              disabled={!!initialLeadId}
              className="w-full rounded-lg border border-[#1B1B1B]/20 bg-[#F2F0EF] px-3 py-2 font-sans text-sm text-[#1B1B1B] disabled:opacity-60"
            />
            {showDropdown && leadOptions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg">
                {leadOptions.map((opt) => (
                  <li
                    key={opt.id}
                    onClick={() => { setLeadId(opt.id); setLeadQuery(opt.name); setShowDropdown(false); }}
                    className="cursor-pointer px-3 py-2 font-sans text-sm text-[#1B1B1B] hover:bg-[#F2F0EF]"
                  >
                    {opt.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">Pipeline *</label>
            <div className="flex gap-2">
              {(["BUYERS", "SELLERS"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPipeline(p)}
                  className={`flex-1 rounded-lg border px-3 py-2 font-sans text-sm transition-colors ${
                    pipeline === p
                      ? "border-[#9E8C61] bg-[#9E8C61]/10 font-medium text-[#9E8C61]"
                      : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40"
                  }`}
                >
                  {p === "BUYERS" ? "Buyers" : "Sellers"}
                </button>
              ))}
            </div>
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
        </div>

        <div className="mt-6 flex justify-end gap-2">
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
            {saving ? "Creating…" : "Create Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}
