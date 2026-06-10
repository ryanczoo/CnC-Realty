"use client";

import { useRef, useState, useCallback } from "react";
import { useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { computeSegmentProgress } from "@/lib/motion";

// Drives a segmented scroll-stepper: active index, directional ref, and bar widths.
// Bar heights are written directly to the DOM (via registerBarEl refs) to avoid
// React re-renders at 60fps during scroll. Only activeIdx uses state.
export function useScrollStepper(scrollYProgress: MotionValue<number>, count: number, prop: "height" | "width" = "height") {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollDirRef = useRef<"down" | "up">("down");
  const lastIdxRef = useRef(0);
  const lastScrollRef = useRef(0);
  const barElsRef = useRef<(HTMLDivElement | null)[]>(Array(count).fill(null));

  const registerBarEl = useCallback((i: number, el: HTMLDivElement | null) => {
    barElsRef.current[i] = el;
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const dir = p >= lastScrollRef.current ? "down" : "up";
    lastScrollRef.current = p;
    scrollDirRef.current = dir;
    const next = Math.min(Math.floor(p * count), count - 1);
    if (next !== lastIdxRef.current) {
      lastIdxRef.current = next;
      setActiveIdx(next);
    }
    const widths = computeSegmentProgress(p, count);
    barElsRef.current.forEach((el, i) => {
      if (el) el.style[prop] = `${Math.round(widths[i])}%`;
    });
  });

  return { activeIdx, scrollDirRef, registerBarEl };
}
