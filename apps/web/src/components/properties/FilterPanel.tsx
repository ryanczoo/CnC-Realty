"use client";

import type { ReactNode } from "react";

// One frame for every filter dropdown — a drop-down under the pill on desktop,
// a slide-up sheet on phones (same classes the five copies used before) — with
// Zillow's Apply button at the bottom.
const FRAME =
  "absolute left-0 top-full z-40 mt-1 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:mt-0 max-lg:w-auto max-lg:rounded-b-none max-lg:rounded-t-2xl max-lg:max-h-[75svh] max-lg:overflow-y-auto max-lg:py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]";

export function FilterPanel({ width, onApply, children }: { width: string; onApply: () => void; children: ReactNode }) {
  return (
    <div className={`${FRAME} ${width}`}>
      {children}
      <div className="px-3 pb-1 pt-2">
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
