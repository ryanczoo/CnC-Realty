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
  mobileHeightClass?: string;
  playbackRate?: number;
  overlayOpacity?: number;
  videoPosition?: string;
  heading?: string;
}

const LINE_Y: Record<number, number[]> = {
  1: [540],
  2: [400, 710],
};

// Phone (portrait) lettering: one word per line on a 1080×1920 canvas.
// 180 keeps the longest word ("MANAGE") inside the visible width of a folded
// Galaxy Fold (~344px wide), where the "slice" crop hides the most width.
export const PHONE_TEXT_SIZE = "180";
const PHONE_LINE_GAP = 260;

export function phoneWordLayout(lines: string[]): { word: string; y: number }[] {
  const words = lines.flatMap((line) => line.split(" ").filter(Boolean));
  const mid = (words.length - 1) / 2;
  return words.map((word, i) => ({ word, y: 960 + (i - mid) * PHONE_LINE_GAP }));
}

export function VideoMaskHero({ maskId, videoSrc, lines, heightClass = "h-[95vh]", mobileHeightClass = "max-lg:h-[95svh]", playbackRate = 1, overlayOpacity = 0, videoPosition = "object-center", heading }: Props) {
  const yPositions = LINE_Y[lines.length] ?? LINE_Y[2];

  return (
    <section data-navbar-theme="dark" className={`relative overflow-hidden bg-black ${heightClass} ${mobileHeightClass}`}>
      {heading && <h1 className="sr-only">{heading}</h1>}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        ref={(el) => {
          if (el) el.playbackRate = playbackRate;
        }}
        className={`absolute inset-0 h-full w-full object-cover ${videoPosition}`}
        src={videoSrc}
      />

      {overlayOpacity > 0 && (
        <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />
      )}

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full max-lg:portrait:hidden"
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

      <svg
        aria-hidden="true"
        className="absolute inset-0 hidden h-full w-full max-lg:portrait:block"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id={`${maskId}-mobile`}>
            <rect width="1080" height="1920" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              {phoneWordLayout(lines).map(({ word, y }, i) => (
                <motion.text
                  key={`${word}-${i}`}
                  {...TEXT_PROPS}
                  x="540"
                  fontSize={PHONE_TEXT_SIZE}
                  y={y}
                  variants={WORD_VARIANT}
                >
                  {word}
                </motion.text>
              ))}
            </motion.g>
          </mask>
        </defs>
        <rect width="1080" height="1920" fill="black" fillOpacity="0.72" mask={`url(#${maskId}-mobile)`} />
      </svg>

      <DownArrow />
    </section>
  );
}
