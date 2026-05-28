"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

const CARDS = [
  {
    number: "01",
    title: "CRMLS Exposure",
    body: "Your listing reaches every buyer's agent in California's largest MLS the day it goes live.",
    bg: "#D5D1CB",
    innerBg: "rgba(0,0,0,0.06)",
  },
  {
    number: "02",
    title: "Expert Pricing",
    body: "We pull real comp data to price your home where it will sell — not sit.",
    bg: "#DDD9D4",
    innerBg: "rgba(0,0,0,0.05)",
  },
  {
    number: "03",
    title: "Fully Managed",
    body: "Photos, listing, showings, offers, escrow — your agent handles all of it so you don't have to.",
    bg: "#E6E3DF",
    innerBg: "rgba(0,0,0,0.04)",
  },
  {
    number: "04",
    title: "Fast Closings",
    body: "Our transaction system keeps every deadline on track from offer acceptance to keys.",
    bg: "#EDECEA",
    innerBg: "rgba(0,0,0,0.04)",
  },
];

// Cards stick below the navbar. Height fills from here to the viewport bottom.
const STICKY_TOP = 80;

function StackCard({
  card,
  index,
  isLast,
}: {
  card: (typeof CARDS)[0];
  index: number;
  isLast: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Wrapper height = card height = viewport height minus sticky top.
  // At progress=0 the next card's top is at the viewport bottom (peeks 80px).
  // Over progress 0→1 the next card rises and covers this card.
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.9]);
  const innerOpacity = useTransform(
    scrollYProgress,
    [0, 0.65, 1],
    [1, isLast ? 1 : 0.45, isLast ? 1 : 0.08]
  );

  return (
    <div
      ref={wrapperRef}
      style={{ height: `calc(100vh - ${STICKY_TOP}px)` }}
    >
      <motion.div
        style={{
          position: "sticky",
          top: STICKY_TOP,
          zIndex: index + 1,
          height: `calc(100vh - ${STICKY_TOP}px)`,
          backgroundColor: card.bg,
          scale,
          transformOrigin: "50% 0%",
        }}
        className="overflow-hidden rounded-[20px] will-change-transform"
      >
        <motion.div
          style={{ opacity: innerOpacity }}
          className="flex h-full flex-col px-10 pb-10 pt-10 lg:px-14 lg:pb-12 lg:pt-12"
        >
          {/* Top row: number + large title + arrow */}
          <div className="flex items-start justify-between">
            <div className="flex items-end gap-4">
              <span className="mb-3 font-sans text-sm text-[#1B1B1B]/30">
                {card.number}.
              </span>
              <h3 className="font-sans text-[3.5rem] font-light leading-none tracking-tight text-[#1B1B1B] lg:text-[5.5rem]">
                {card.title}
              </h3>
            </div>
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1B1B1B]/20">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 14L14 2M14 2H4M14 2V12"
                  stroke="#1B1B1B"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Bottom content box — mimics Vorszk's inner card */}
          <div
            className="mt-auto rounded-[14px] p-8 lg:p-10"
            style={{ backgroundColor: card.innerBg }}
          >
            <p className="max-w-lg font-sans text-base font-light leading-relaxed text-[#1B1B1B]/55 lg:text-lg">
              {card.body}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function SellStackedCards() {
  return (
    <section className="bg-[#F2F0EF] px-4 lg:px-8">
      <div className="py-16">
        <h2 className="mb-10 px-4 font-sans text-[2rem] font-light text-[#1B1B1B] lg:px-4">
          Why sell with CnC
        </h2>
        {CARDS.map((card, i) => (
          <StackCard
            key={card.number}
            card={card}
            index={i}
            isLast={i === CARDS.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
