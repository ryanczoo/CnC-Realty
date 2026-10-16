"use client";

import type { ReactNode } from "react";

// One frame for every filter dropdown — a drop-down under the pill on desktop;
// on phones a full-width menu directly under the filter row (FilterBar sets
// --filter-bar-bottom to the row's bottom edge while a menu is open) — with
// Zillow's Apply button at the bottom.
const FRAME =
  "absolute left-0 top-full z-40 mt-1 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl max-lg:fixed max-lg:inset-x-0 max-lg:top-[var(--filter-bar-bottom,0px)] max-lg:bottom-auto max-lg:mt-0 max-lg:w-auto max-lg:rounded-t-none max-lg:rounded-b-2xl max-lg:max-h-[calc(100svh_-_var(--filter-bar-bottom,0px)_-_0.75rem)] max-lg:overflow-y-auto max-lg:py-3";

export function FilterPanel({ width, onApply, children }: { width: string; onApply: () => void; children: ReactNode }) {
  return (
    <div className={`${FRAME} ${width}`}>
      {children}
      {/* Phones: pinned to the bottom of the sheet so a long list (Type on a
          sideways phone) scrolls under it instead of hiding it */}
      <div className="px-3 pb-1 pt-2 max-lg:sticky max-lg:-bottom-3 max-lg:bg-[#1a1a1a] max-lg:pb-3">
        <button
          type="button"
          onClick={onApply}
          className="w-full rounded-full bg-[#F2F0EF] py-2 text-sm font-medium text-[#1B1B1B] transition-opacity hover:opacity-90 max-lg:py-3 max-lg:text-base"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function FilterOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm max-lg:py-3 max-lg:text-base hover:bg-white/5 ${
        selected ? "text-[#9E8C61]" : "text-white/70 hover:text-white"
      }`}
    >
      <span className={`h-2 w-2 rounded-full border ${selected ? "border-[#9E8C61] bg-[#9E8C61]" : "border-white/30"}`} />
      {children}
    </button>
  );
}
