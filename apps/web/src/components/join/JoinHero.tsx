"use client";

import { DownArrow } from "@/components/ui/DownArrow";
import { motion } from "motion/react";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.56 } },
};

const word = {
  hidden: { opacity: 0, x: -14 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.9, ease: "easeOut" } },
};

const TEXT_STYLE = {
  fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  fontWeight: 300,
};

export function JoinHero() {
  return (
    <section data-navbar-theme="dark" className="relative h-[95vh] overflow-hidden bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover object-center"
        src="/videos/join-hero.mp4"
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="be-cnc-mask">
            <rect width="1920" height="1080" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              <motion.text
                x="860" y="400"
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="320"
                fill="black"
                style={TEXT_STYLE}
                variants={word}
              >
                Be
              </motion.text>
              <motion.text
                x="860" y="680"
                textAnchor="start"
                dominantBaseline="middle"
                fontSize="320"
                fill="black"
                style={TEXT_STYLE}
                variants={word}
              >
                CnC
              </motion.text>
            </motion.g>
          </mask>
        </defs>
        <rect width="1920" height="1080" fill="black" fillOpacity="0.72" mask="url(#be-cnc-mask)" />
      </svg>

      <DownArrow />
    </section>
  );
}
