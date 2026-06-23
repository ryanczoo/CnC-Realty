"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { Clock, Home, TrendingUp, KeyRound } from "lucide-react";

type StatType = "years" | "listings" | "volume" | "rented";
export type StatCardData = { type: StatType; value: string; label: string };

const ICONS: Record<StatType, React.ReactNode> = {
  years:    <Clock      size={32} color="white" strokeWidth={1.5} />,
  listings: <Home       size={32} color="white" strokeWidth={1.5} />,
  volume:   <TrendingUp size={32} color="white" strokeWidth={1.5} />,
  rented:   <KeyRound   size={32} color="white" strokeWidth={1.5} />,
};

// FIND uses ~26px stagger increments
const Y_START = [70, 96, 122, 148] as const;

function SingleCard({
  type, value, label, index, scrollYProgress,
}: {
  type: StatType;
  value: string;
  label: string;
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  const pOffset = index * 0.06;
  const y = useTransform(scrollYProgress, [pOffset, pOffset + 0.38], [Y_START[index], 0]);
  const opacity = useTransform(scrollYProgress, [pOffset, pOffset + 0.22], [0, 1]);

  return (
    <motion.div
      style={{
        y,
        opacity,
        backgroundColor: "rgba(33,33,33,0.9)",
        border: "1px solid rgba(179,179,179,0.1)",
      }}
      className="flex min-w-[200px] flex-shrink-0 [scroll-snap-align:start] flex-col rounded-2xl p-6 md:aspect-square md:min-w-0 md:p-[3.2rem]"
    >
      <div>{ICONS[type]}</div>
      <div className="mt-auto pt-8">
        <p
          className="font-sans font-medium leading-none text-white"
          style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)", letterSpacing: "-0.01em" }}
        >
          {value}
        </p>
        <p className="mt-2 font-sans text-xs font-medium text-[#B3B3B3] md:mt-4 md:text-sm">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

export function StatCards({ stats }: { stats: StatCardData[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <div
      ref={ref}
      className="flex gap-2.5 overflow-x-auto pb-1 [scroll-snap-type:x_mandatory] md:grid md:grid-cols-4 md:overflow-visible md:pb-0"
      style={{ scrollbarWidth: "none" }}
    >
      {stats.map((stat, i) => (
        <SingleCard
          key={stat.label}
          type={stat.type}
          value={stat.value}
          label={stat.label}
          index={i}
          scrollYProgress={scrollYProgress}
        />
      ))}
    </div>
  );
}
