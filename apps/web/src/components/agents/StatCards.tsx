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

// Phones: 2 rows of 2 (was a sideways swipe strip — only 1 card fit on screen and the strip
// clipped the staggered cards). auto-rows-fr keeps all 4 phone cards the same height (a 2-line
// label would otherwise make one taller). Tablet/desktop (md+): the same square 4-across row.
export const STAT_GRID_CLS = "grid grid-cols-2 auto-rows-fr gap-2.5 md:grid-cols-4";
export const STAT_CARD_CLS = "flex min-w-0 flex-col rounded-2xl p-6 md:aspect-square md:p-[3.2rem]";

// A value with 4+ digits (e.g. "$125.4M") is ~129px wide at the normal 32px, but a 360px phone
// card only has ~109px of room. Below md those values shrink with the card's room, which is
// about (50vw − 71px); the widest digits ("$444.4M") need ~4.03px of width per px of font size,
// so 4.1 leaves a little slack. From ~430px wide it caps at the normal 2rem. `!` overrides the
// inline desktop size, which stays exactly as it was from md up.
export const STAT_VALUE_FIT_CLS = "max-md:!text-[clamp(1.25rem,calc((50vw_-_71px)_/_4.1),2rem)]";

export function isLongStatValue(value: string): boolean {
  return (value.match(/\d/g)?.length ?? 0) >= 4;
}

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
      className={STAT_CARD_CLS}
    >
      <div>{ICONS[type]}</div>
      <div className="mt-auto pt-8">
        <p
          className={`font-sans font-medium leading-none text-white${isLongStatValue(value) ? ` ${STAT_VALUE_FIT_CLS}` : ""}`}
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
    <div ref={ref} className={STAT_GRID_CLS}>
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
