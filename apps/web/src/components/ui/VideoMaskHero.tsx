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

interface Props {
  maskId: string;
  videoSrc: string;
  lines: string[];
  heightClass?: string;
  playbackRate?: number;
  overlayOpacity?: number;
}

const LINE_Y: Record<number, number[]> = {
  1: [540],
  2: [400, 710],
};

export function VideoMaskHero({ maskId, videoSrc, lines, heightClass = "h-[95vh]", playbackRate = 1, overlayOpacity = 0 }: Props) {
  const yPositions = LINE_Y[lines.length] ?? LINE_Y[2];

  return (
    <section data-navbar-theme="dark" className={`relative overflow-hidden bg-black ${heightClass}`}>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        ref={(el) => {
          if (el) el.playbackRate = playbackRate;
        }}
        className="absolute inset-0 h-full w-full object-cover object-center"
        src={videoSrc}
      />

      {overlayOpacity > 0 && (
        <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />
      )}

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id={maskId}>
            <rect width="1920" height="1080" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              {lines.map((line, i) => (
                <motion.text key={line} {...TEXT_PROPS} y={yPositions[i]} variants={WORD_VARIANT}>
                  {line}
                </motion.text>
              ))}
            </motion.g>
          </mask>
        </defs>
        <rect width="1920" height="1080" fill="black" fillOpacity="0.72" mask={`url(#${maskId})`} />
      </svg>

      <DownArrow />
    </section>
  );
}
