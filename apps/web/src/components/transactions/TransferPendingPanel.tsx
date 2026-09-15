"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { ChecklistPanel } from "./ChecklistPanel";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

interface Props {
  fileType: "listing" | "transaction";
  fileId: string;
  checklistItems: FileChecklistItemWithDocs[];
  onUploaded: () => void;
  /** The address already saved on this file, so a reload shows it back rather than a blank box. */
  initialAddress?: string;
}

export function TransferPendingPanel({ fileType, fileId, checklistItems, onUploaded, initialAddress = "" }: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setSaving(true);
    setError(null);
    const endpoint = fileType === "listing" ? `/api/listings/${fileId}` : `/api/transactions/${fileId}`;
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyAddress: address }),
      });
      if (res.ok) {
        setSaved(true);
      } else {
        setError("Couldn't save that address. Please try again.");
      }
    } catch {
      setError("Couldn't save that address. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const downloadHref = fileType === "listing" ? "/api/transfer-forms/listing" : "/api/transfer-forms/pending-sale";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">This file is locked</h2>
        <p className="text-sm text-[#1B1B1B]/60">
          You told us you have {fileType === "listing" ? "an active listing" : "a pending sale"} to transfer from
          your previous brokerage. Download the blank transfer authorization below, get it signed by your previous
          broker, then upload the signed copy — this file unlocks the moment it's approved.
        </p>
        <a
          href={downloadHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B] hover:border-[#1B1B1B]/40"
        >
          <Download className="h-4 w-4" /> Download blank form
        </a>
      </div>

      <form onSubmit={saveAddress} className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Property Address (optional)</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSaved(false); setError(null); }}
            placeholder="123 Main St, Anytown, CA"
            className="flex-1 rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
          />
          <button
            type="submit"
            disabled={saving || !address.trim()}
            className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {saved && !error && <p className="text-xs text-green-600">Saved.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Upload Signed Authorization</h2>
        <ChecklistPanel
          fileType={fileType === "listing" ? "LISTING" : "TRANSACTION"}
          fileId={fileId}
          items={checklistItems}
          onUploaded={onUploaded}
        />
      </div>
    </div>
  );
}
