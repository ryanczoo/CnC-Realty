"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { value: "100%", label: "Commission Kept" },
  { value: "$0", label: "Monthly Fees" },
  { value: "24/7", label: "Broker Support" },
  { value: "30+", label: "Resources" },
];

const DIGITS = "0123456789";

function scramble(target: string, progress: number): string {
  return target
    .split("")
    .map((char) => {
      if (!/[0-9]/.test(char)) return char;
      if (Math.random() < progress) return char;
      return DIGITS[Math.floor(Math.random() * DIGITS.length)];
    })
    .join("");
}

function AnimatedStat({
  value,
  label,
  triggered,
  duration,
}: {
  value: string;
  label: string;
  triggered: boolean;
  duration: number;
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

  return (
    <div className="text-center">
      <p className="font-chopin text-3xl font-bold tabular-nums text-white">{displayed}</p>
      <p className="mt-1 font-sans text-xs font-light uppercase tracking-widest text-white/70">{label}</p>
    </div>
  );
}

export function StatsBar() {
  const ref = useRef<HTMLElement>(null);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-[#9E8C61]">
      <div className="mx-auto flex max-w-5xl flex-wrap justify-around gap-8 px-8 py-10">
        {STATS.map((stat, i) => (
          <AnimatedStat
            key={stat.label}
            value={stat.value}
            label={stat.label}
            triggered={triggered}
            duration={700 + i * 600}
          />
        ))}
      </div>
    </section>
  );
}
