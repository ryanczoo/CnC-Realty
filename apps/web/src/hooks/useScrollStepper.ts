"use client";

import { useRef, useState } from "react";
import { useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { computeSegmentProgress } from "@/lib/motion";

// Drives a segmented scroll-stepper: active index, directional ref, and bar widths.
// scrollDir is a ref (not state) so it updates synchronously before re-renders —
// AnimatePresence reads the correct direction without an extra render cycle.
export function useScrollStepper(scrollYProgress: MotionValue<number>, count: number) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [barWidths, setBarWidths] = useState(() => Array<number>(count).fill(0));
  const scrollDirRef = useRef<"down" | "up">("down");
  const lastIdxRef = useRef(0);
  const lastBarRef = useRef<number[]>([]);
  const lastScrollRef = useRef(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const dir = p >= lastScrollRef.current ? "down" : "up";
    lastScrollRef.current = p;
    scrollDirRef.current = dir;
    const next = Math.min(Math.floor(p * count), count - 1);
    if (next !== lastIdxRef.current) {
      lastIdxRef.current = next;
      setActiveIdx(next);
    }
    const nextWidths = computeSegmentProgress(p, count);
    if (nextWidths.some((w, i) => Math.round(w) !== Math.round(lastBarRef.current[i] ?? -1))) {
      lastBarRef.current = nextWidths;
      setBarWidths(nextWidths);
    }
  });

  return { activeIdx, scrollDirRef, barWidths };
}
