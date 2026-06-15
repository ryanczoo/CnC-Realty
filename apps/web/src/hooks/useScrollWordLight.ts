"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollWordLight(wordCount: number) {
  const sectionRef = useRef<HTMLElement>(null);
  const [litCount, setLitCount] = useState(0);
  const lastCountRef = useRef(-1);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let sectionTop = section.offsetTop;
    let vh = window.innerHeight;

    const compute = () => {
      const next = Math.round(Math.max(0, Math.min(1, (window.scrollY + vh - sectionTop) / vh)) * wordCount);
      if (next === lastCountRef.current) return;
      lastCountRef.current = next;
      setLitCount(next);
    };

    const onResize = () => { sectionTop = section.offsetTop; vh = window.innerHeight; compute(); };
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", compute, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", onResize);
    };
  }, [wordCount]);

  return { sectionRef, litCount };
}
