"use client";

import { DownArrow } from "@/components/ui/DownArrow";
import { motion } from "motion/react";
import { wordContainer, WORD_VARIANT } from "@/lib/motion";

const container = wordContainer(0.28);

const TEXT_PROPS = {
  x: "960",
  textAnchor: "middle" as const,
  dominantBaseline: "middle" as const,
  fontSize: "240",
  fill: "black",
  style: { fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif", fontWeight: 300 },
};

export function SellHero() {
  return (
    <section data-navbar-theme="dark" className="relative h-[95vh] overflow-hidden bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover object-center"
        src="/videos/sell-hero.mp4"
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="sell-hero-mask">
            <rect width="1920" height="1080" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              <motion.text {...TEXT_PROPS} textAnchor="end" x="930" y="400" variants={WORD_VARIANT}>SELL</motion.text>
              <motion.text {...TEXT_PROPS} textAnchor="start" x="990" y="400" variants={WORD_VARIANT}>WITH</motion.text>
              <motion.text {...TEXT_PROPS} y="710" variants={WORD_VARIANT}>US</motion.text>
            </motion.g>
          </mask>
        </defs>
        <rect width="1920" height="1080" fill="black" fillOpacity="0.72" mask="url(#sell-hero-mask)" />
      </svg>

      <DownArrow />
    </section>
  );
}
