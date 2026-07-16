"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import type { PriceBar } from "@/lib/home-value-estimate";
import { ScrambleValue } from "@/components/ui/ScrambleValue";

export function computeBarHeights(bars: { value: number }[]): number[] {
  const max = Math.max(0, ...bars.map((b) => b.value));
  if (max === 0) return bars.map(() => 0);
  return bars.map((b) => Math.round((b.value / max) * 100));
}

interface Props {
  bars: PriceBar[];
  medianPrice: number | null;
  zip: string;
}

export function LocalMarketSnapshot({ bars, medianPrice, zip }: Props) {
  const heights = computeBarHeights(bars);
  const medianRef = useRef<HTMLDivElement>(null);
  const medianInView = useInView(medianRef, { once: true, amount: 0.6 });

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Local Market Stats</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes sold by price in the past year
      </p>

      {bars.length === 0 ? (
        <p className="mt-8 text-sm text-[#1B1B1B]/60">
          No sales within the past year in {zip}
        </p>
      ) : (
        <>
          <div className="mt-8 flex h-40 items-end gap-6">
            {bars.map((b, i) => (
              <div key={`${b.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end">
                  <div
                    className="w-full rounded-t bg-[#9E8C61]/70"
                    style={{ height: `${heights[i]}%` }}
                  />
                </div>
                <p className="text-xs text-[#1B1B1B]/60">{b.label}</p>
                {b.count != null && (
                  <p className="text-xs font-medium text-[#1B1B1B]">{b.count}</p>
                )}
              </div>
            ))}
          </div>

          {medianPrice != null && (
            <div ref={medianRef} className="mt-6 flex flex-col items-center gap-1 text-center">
              <p className="text-sm text-[#1B1B1B]/60">Median sold price in the past year</p>
              <ScrambleValue
                value={`$${medianPrice.toLocaleString()}`}
                triggered={medianInView}
                className="text-[1.75rem] font-bold tabular-nums text-[#1B1B1B]"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
