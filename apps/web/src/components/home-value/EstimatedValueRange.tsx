"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { ScrambleValue } from "@/components/ui/ScrambleValue";

export function EstimatedValueRange({ low, high }: { low: number; high: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  return (
    <div ref={ref}>
      <p className="text-sm text-[#1B1B1B]/50">Estimated Value Range</p>
      <ScrambleValue
        value={`$${low.toLocaleString()} – $${high.toLocaleString()}`}
        triggered={inView}
        className="mt-2 text-3xl font-bold tabular-nums text-[#1B1B1B]"
      />
    </div>
  );
}
