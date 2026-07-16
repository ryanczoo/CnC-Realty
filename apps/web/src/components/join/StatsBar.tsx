"use client";

import { useEffect, useRef, useState } from "react";
import { ScrambleValue } from "@/components/ui/ScrambleValue";

const STATS = [
  { value: "100%", label: "Commission" },
  { value: "$0", label: "Monthly Fees" },
  { value: "24/7", label: "Broker Support" },
  { value: "30+", label: "Resources" },
];

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
  return (
    <div className="text-center">
      <ScrambleValue
        value={value}
        triggered={triggered}
        duration={duration}
        className="font-chopin text-3xl font-bold tabular-nums text-white"
      />
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
