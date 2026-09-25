"use client";
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
}: {
  current: string;
  statuses: string[];
  disabled?: boolean;
  onChange: (status: string) => void;
  deleteAction?: { label: string; onSelect: () => void };
}) {
  return (
    <select
      disabled={disabled}
      value={current}
      onChange={(e) => (e.target.value === DELETE_VALUE ? deleteAction?.onSelect() : onChange(e.target.value))}
      className="rounded-full border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm text-[#1B1B1B] disabled:opacity-50"
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{statusLabel(s)}</option>
      ))}
      {deleteAction && <option disabled>──────────</option>}
      {deleteAction && <option value={DELETE_VALUE}>{deleteAction.label}</option>}
    </select>
  );
}
