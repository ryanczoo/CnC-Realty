"use client";

import { useEffect, useRef, useState } from "react";

const DIGITS = "0123456789";
const INTERVAL = 40;
const SETTLE = 1200; // last 1200ms is the settle window where digits lock in, left to right

export function countDigits(value: string): number {
  return value.split("").filter((char) => /[0-9]/.test(char)).length;
}

// How many of the leftmost digit positions should be permanently locked to
// their real value by this step. Holds at 0 until settleStep, then locks one
// more digit at a time (left to right) as the settle window progresses,
// reaching totalDigits by totalSteps. Monotonically non-decreasing, so a
// position can never un-lock once reached.
export function lockedDigitCount(
  step: number,
  totalSteps: number,
  settleStep: number,
  totalDigits: number
): number {
  if (step <= settleStep) return 0;
  if (step >= totalSteps) return totalDigits;
  const fraction = (step - settleStep) / (totalSteps - settleStep);
  return Math.min(totalDigits, Math.floor(fraction * totalDigits));
}

// Renders the leftmost `lockedCount` digit positions at their real value and
// randomizes every digit position after that. Non-digit characters always
// pass through unchanged.
export function scrambleSequential(value: string, lockedCount: number): string {
  let digitsSeen = 0;
  return value
    .split("")
    .map((char) => {
      if (!/[0-9]/.test(char)) return char;
      const isLocked = digitsSeen < lockedCount;
      digitsSeen++;
      return isLocked ? char : DIGITS[Math.floor(Math.random() * DIGITS.length)];
    })
    .join("");
}

// Shared scrambling-text timer: digits randomize, then lock in one at a time
// left to right, reusable anywhere a value should settle into its real value
// once `triggered` flips true.
export function useScramble(value: string, triggered: boolean, duration = 900): string {
  const [displayed, setDisplayed] = useState(value.replace(/[0-9]/g, "–"));
  const hasRun = useRef(false);

  useEffect(() => {
    if (!triggered || hasRun.current) return;
    hasRun.current = true;

    const totalSteps = Math.round(duration / INTERVAL);
    const settleStep = Math.round((duration - SETTLE) / INTERVAL);
    const totalDigits = countDigits(value);
    let step = 0;

    const id = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        clearInterval(id);
        setDisplayed(value);
        return;
      }
      const lockedCount = lockedDigitCount(step, totalSteps, settleStep, totalDigits);
      setDisplayed(scrambleSequential(value, lockedCount));
    }, INTERVAL);

    return () => clearInterval(id);
  }, [triggered, value, duration]);

  return displayed;
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
  const displayed = useScramble(value, triggered, duration);
  return <p className={className}>{displayed}</p>;
}
