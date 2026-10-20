"use client";

import { DownArrow } from "@/components/ui/DownArrow";
import { motion } from "motion/react";
import { wordContainer, WORD_VARIANT } from "@/lib/motion";
import { phoneWordLayout, PHONE_TEXT_SIZE } from "@/components/ui/VideoMaskHero";

const container = wordContainer(0.56);

const TEXT_STYLE = {
  fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  fontWeight: 300,
};

export function JoinHero() {
  return (
    <section data-navbar-theme="dark" className="relative h-[95vh] overflow-hidden bg-black max-lg:h-[95svh]">
      <h1 className="sr-only">Be CnC – Join CnC Realty</h1>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover object-center"
        src="/videos/join-hero.mp4"
      />

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full max-lg:portrait:hidden"
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
                variants={WORD_VARIANT}
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
                variants={WORD_VARIANT}
              >
                CnC
              </motion.text>
            </motion.g>
          </mask>
        </defs>
        <rect width="1920" height="1080" fill="black" fillOpacity="0.72" mask="url(#be-cnc-mask)" />
      </svg>

      <svg
        aria-hidden="true"
        className="absolute inset-0 hidden h-full w-full max-lg:portrait:block"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="be-cnc-mask-mobile">
            <rect width="1080" height="1920" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              {phoneWordLayout(["Be", "CnC"]).map(({ word, y }, i) => (
                <motion.text
                  key={`${word}-${i}`}
                  x="540"
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={PHONE_TEXT_SIZE}
                  fill="black"
                  style={TEXT_STYLE}
                  variants={WORD_VARIANT}
                >
                  {word}
                </motion.text>
              ))}
            </motion.g>
          </mask>
        </defs>
        <rect width="1080" height="1920" fill="black" fillOpacity="0.72" mask="url(#be-cnc-mask-mobile)" />
      </svg>

      <DownArrow />
    </section>
  );
}
