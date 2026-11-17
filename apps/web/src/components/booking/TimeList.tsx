"use client";
import { formatTimePT } from "@/lib/booking/format";

interface TimeListProps {
  slots: string[];
  chosen: string | null;
  onPick: (iso: string) => void;
  /** Shown above the times (e.g. "That time was just taken…"). */
  notice: string | null;
}

// The open times for the selected day. Desktop: one column; phone: a 3-up grid.
// Pills use a plain CSS hover (grid controls, not CTA buttons).
export function TimeList({ slots, chosen, onPick, notice }: TimeListProps) {
  return (
    <div className="flex flex-col gap-2">
      {notice && <p className="text-sm text-red-500">{notice}</p>}
      {slots.length === 0 ? (
        <p className="text-sm text-[#1B1B1B]/50">No open times this day.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-lg:grid-cols-3">
          {slots.map((iso) => {
            const label = formatTimePT(new Date(iso));
            const picked = iso === chosen;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onPick(iso)}
                aria-label={label}
                aria-pressed={picked}
                className={`rounded-full border py-2 text-sm transition-colors ${
                  picked
                    ? "border-[#9E8C61] bg-[#9E8C61] text-white"
                    : "border-[#1B1B1B]/15 hover:border-[#1B1B1B]/50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
