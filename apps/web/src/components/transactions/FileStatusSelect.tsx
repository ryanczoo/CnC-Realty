"use client";
import { ChevronDown } from "lucide-react";
import { statusLabel } from "./StatusBadge";

const DELETE_VALUE = "__delete__";

// The one status dropdown for file pages — the admin page (every file) and the
// agent's listing page. Picking a status applies it immediately via onChange.
// deleteAction (admin only) adds a separated "Delete …" entry that runs its own
// confirm flow and never changes the status.
export function FileStatusSelect({
  current,
  statuses,
  disabled,
  onChange,
  deleteAction,
  optionLabel,
}: {
  current: string;
  statuses: string[];
  disabled?: boolean;
  onChange: (status: string) => void;
  deleteAction?: { label: string; onSelect: () => void };
  // Override an option's text (e.g. the agent's "Request Cancellation").
  optionLabel?: (status: string) => string;
}) {
  // Browser arrow hidden and replaced by a chevron inside the pill — the same
  // appearance-none + ChevronDown pattern as the join ApplicationForm selects.
  return (
    <div className="relative">
      <select
        disabled={disabled}
        value={current}
        onChange={(e) => (e.target.value === DELETE_VALUE ? deleteAction?.onSelect() : onChange(e.target.value))}
        className="appearance-none rounded-full border border-[#1B1B1B]/10 bg-white py-2 pl-4 pr-9 text-sm text-[#1B1B1B] disabled:opacity-50"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{optionLabel?.(s) ?? statusLabel(s)}</option>
        ))}
        {deleteAction && <option disabled>──────────</option>}
        {deleteAction && <option value={DELETE_VALUE}>{deleteAction.label}</option>}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#1B1B1B]/40" />
    </div>
  );
}
