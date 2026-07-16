"use client";

import { useEffect, useRef, useState } from "react";

const DIGITS = "0123456789";

export function scramble(target: string, progress: number): string {
  return target
    .split("")
    .map((char) => {
      if (!/[0-9]/.test(char)) return char;
      if (Math.random() < progress) return char;
      return DIGITS[Math.floor(Math.random() * DIGITS.length)];
    })
    .join("");
}

export function ScrambleValue({
  value,
  triggered,
  duration = 900,
  className,
}: {
  value: string;
  triggered: boolean;
  duration?: number;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(value.replace(/[0-9]/g, "–"));
  const hasRun = useRef(false);

  useEffect(() => {
    if (!triggered || hasRun.current) return;
    hasRun.current = true;

    const INTERVAL = 40;
    const SETTLE = 300; // last 300ms eases into correct value
    const totalSteps = Math.round(duration / INTERVAL);
    const settleStep = Math.round((duration - SETTLE) / INTERVAL);
    let step = 0;

    const id = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        clearInterval(id);
        setDisplayed(value);
        return;
      }
      const progress = step < settleStep
        ? 0
        : (step - settleStep) / (totalSteps - settleStep);
      setDisplayed(scramble(value, progress * progress));
    }, INTERVAL);

    return () => clearInterval(id);
  }, [triggered, value, duration]);

  return <p className={className}>{displayed}</p>;
}
