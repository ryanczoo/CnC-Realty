"use client";

import { digitsOnly, formatWithCommas } from "@/lib/form-validation";
import { LAST_STEP, maxIndexFor, maxValueAt, minIndexFor, minValueAt, stepLabel } from "@/lib/price-steps";

interface Props {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}

// Two standard range inputs stacked on one track; only their thumbs take
// pointer/touch events, so each handle drags on its own (no slider library).
const RANGE =
  "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#F2F0EF] [&::-webkit-slider-thumb]:bg-[#9E8C61] " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#F2F0EF] [&::-moz-range-thumb]:bg-[#9E8C61]";

export function PriceRangeFilter({ min, max, onChange }: Props) {
  const lo = minIndexFor(min);
  const hi = Math.max(lo, maxIndexFor(max));
  const pct = (i: number) => (i / LAST_STEP) * 100;
  return (
    <div className="px-4 pb-1 pt-3">
      <div className="mb-2 flex justify-between text-xs text-white/50">
        <span>{stepLabel(lo)}</span>
        <span>{stepLabel(hi)}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#9E8C61]"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range" aria-label="Minimum price slider" aria-valuetext={stepLabel(lo)} min={0} max={LAST_STEP} step={1} value={lo}
          onChange={(e) => onChange(minValueAt(Math.min(Number(e.target.value), hi)), max)}
          className={RANGE}
          // When both handles sit at the top end, the min handle must be on top to be draggable
          style={{ zIndex: lo >= hi && lo > LAST_STEP / 2 ? 3 : 1 }}
        />
        <input
          type="range" aria-label="Maximum price slider" aria-valuetext={stepLabel(hi)} min={0} max={LAST_STEP} step={1} value={hi}
          onChange={(e) => onChange(min, maxValueAt(Math.max(Number(e.target.value), lo)))}
          className={RANGE}
          style={{ zIndex: 2 }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PriceBox label="Minimum price" placeholder="No min" value={min} onChange={(v) => onChange(v, max)} />
        <span className="text-white/30">–</span>
        <PriceBox label="Maximum price" placeholder="No max" value={max} onChange={(v) => onChange(min, v)} />
      </div>
    </div>
  );
}

function PriceBox({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-[#0f0f0f] px-2 py-1.5 text-sm text-white focus-within:border-[#9E8C61]/60 max-lg:py-2 max-lg:text-base">
      <span className="sr-only">{label}</span>
      <span className="text-white/40">$</span>
      <input
        inputMode="numeric"
        value={formatWithCommas(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(digitsOnly(e.target.value, 9))}
        className="w-full min-w-0 bg-transparent pl-1 outline-none placeholder-white/30"
      />
    </label>
  );
}
