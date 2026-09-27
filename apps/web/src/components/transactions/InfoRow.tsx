"use client";
import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { DateField } from "@/components/ui/DateField";
import { PencilIcon } from "@/components/ui/PencilIcon";
import { CheckIcon } from "@/components/ui/CheckIcon";
import { CommissionField } from "./CommissionField";

// Opt-in pencil editing for one row (the Overview tab). Reuses the wizards'
// shared inputs so edits follow the same restrictions and formatting.
export interface InfoRowEdit {
  kind: "text" | "currency" | "date" | "select" | "commission";
  raw: string;
  restrict?: (v: string) => string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  options?: readonly string[];
  // kind "commission": the %/$ toggle's starting side; onSave gets the side chosen.
  mode?: "pct" | "flat";
  hideModeToggle?: boolean;
  onSave: (value: string, mode?: "pct" | "flat") => Promise<string | null>;
}

// Shared label/value row used across the file-detail tabs — extracted so
// both OverviewTab and CommissionTab (and any consumer that renders either
// of them, agent-side or admin-side) get the exact same row styling. Pass
// `edit` to add a pencil; without it the row is display-only.
// pencilSlot: in a card where other rows have pencils, a row without one keeps
// the same empty slot so every value lines up on the same right edge.
export function InfoRow({ label, value, edit, pencilSlot = false }: { label: string; value: string; edit?: InfoRowEdit; pencilSlot?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"pct" | "flat">("pct");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setDraft(edit?.raw ?? "");
    setMode(edit?.mode ?? "pct");
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!edit) return;
    setSaving(true);
    setError(null);
    try {
      const err = await edit.onSave(draft, mode);
      if (err) { setError(err); return; }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (edit && editing) {
    return (
      <div className="border-b border-[#1B1B1B]/5 pb-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="shrink-0 text-[#1B1B1B]/50">{label}</span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="w-full max-w-xs">
              {edit.kind === "commission" ? (
                <CommissionField label="" value={draft} onChange={setDraft} mode={mode} onModeChange={setMode} hideModeToggle={edit.hideModeToggle} />
              ) : edit.kind === "date" ? (
                <DateField value={draft} onChange={setDraft} />
              ) : edit.kind === "select" ? (
                <select
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label={label}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
                >
                  <option value="">Select…</option>
                  {edit.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <FormField
                  label={label}
                  labelClassName="sr-only"
                  value={draft}
                  onChange={setDraft}
                  restrict={edit.restrict}
                  inputMode={edit.inputMode}
                  formatCommas={edit.kind === "currency"}
                />
              )}
            </div>
            <button onClick={save} disabled={saving} title="Save" aria-label={`Save ${label}`} className="shrink-0 text-[#9E8C61] hover:text-[#7a6d4a] disabled:opacity-40">
              <CheckIcon size={20} />
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} title="Cancel" aria-label={`Cancel editing ${label}`} className="shrink-0 px-1 text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
              ✕
            </button>
          </div>
        </div>
        {error && <p className="mt-1 text-right text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#1B1B1B]/5 pb-2 text-sm">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium text-[#1B1B1B]">
        {value}
        {edit ? (
          <button onClick={start} title={`Edit ${label}`} aria-label={`Edit ${label}`} className="w-[14px] shrink-0 text-[#1B1B1B]/25 hover:text-[#1B1B1B]">
            <PencilIcon size={14} />
          </button>
        ) : pencilSlot ? (
          <span aria-hidden="true" className="w-[14px] shrink-0" />
        ) : null}
      </span>
    </div>
  );
}
