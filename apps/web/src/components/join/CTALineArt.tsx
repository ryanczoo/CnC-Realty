"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";

// Isometric 3D house — front face visible on-screen, side + back bleed off right.
// The section's overflow:hidden clips everything past the right edge.
//
// Key vertices (SVG coords, viewBox 0 0 700 820, overflow:visible):
//   A(30,650)   front-bottom-left
//   B(270,770)  front-bottom-right
//   C(270,510)  front-top-right
//   D(30,390)   front-top-left
//   E(850,480)  back-bottom-right  (off-screen right)
//   F(850,220)  back-top-right     (off-screen right)
//   G(610,100)  back-top-left
//   Ridge-front(150,250)  Ridge-back(730,-40)

function P({ d, progress }: { d: string; progress: MotionValue<number> }) {
  return (
    <motion.path
      d={d}
      stroke="#9E8C61"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      style={{ opacity: 0.28 }}
      pathLength={progress}
    />
  );
}

export function CTALineArt() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Track the section passing through the viewport — 0 when section enters from
  // below, 1 when section exits above. No easing: raw scroll = raw draw.
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "end start"],
  });

  // Draw order: ridge → front gable → front walls → details → left slope → side
  // Ranges compressed to 0.65× so the house fully draws by 65% scroll through the section
  const pRidge      = useTransform(scrollYProgress, [0.00, 0.18], [0, 1]);
  const pGable      = useTransform(scrollYProgress, [0.04, 0.22], [0, 1]);
  const pFrontLeft  = useTransform(scrollYProgress, [0.12, 0.29], [0, 1]);
  const pFrontBot   = useTransform(scrollYProgress, [0.13, 0.30], [0, 1]);
  const pFrontRight = useTransform(scrollYProgress, [0.14, 0.31], [0, 1]);
  const pFrontTop   = useTransform(scrollYProgress, [0.16, 0.33], [0, 1]);
  const pWindow     = useTransform(scrollYProgress, [0.24, 0.39], [0, 1]);
  const pDoor       = useTransform(scrollYProgress, [0.27, 0.42], [0, 1]);
  const pLeftRoof   = useTransform(scrollYProgress, [0.34, 0.49], [0, 1]);
  const pSideBot    = useTransform(scrollYProgress, [0.40, 0.55], [0, 1]);
  const pSideRight  = useTransform(scrollYProgress, [0.42, 0.57], [0, 1]);
  const pSideTop    = useTransform(scrollYProgress, [0.44, 0.59], [0, 1]);
  const pRightRoof  = useTransform(scrollYProgress, [0.47, 0.65], [0, 1]);

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 700 820"
        overflow="visible"
        fill="none"
        className="absolute right-0 top-1/2 h-[120%] w-[45%] -translate-y-1/2"
      >
        {/* ── Roof ridge: Ridge-front → Ridge-back ── */}
        <P d="M 150,250 L 730,-40" progress={pRidge} />

        {/* ── Front gable: D → Ridge-front → C ── */}
        <P d="M 30,390 L 150,250 L 270,510" progress={pGable} />

        {/* ── Front face walls ── */}
        <P d="M 30,650 L 30,390"   progress={pFrontLeft} />
        <P d="M 30,650 L 270,770"  progress={pFrontBot} />
        <P d="M 270,770 L 270,510" progress={pFrontRight} />
        <P d="M 30,390 L 270,510"  progress={pFrontTop} />

        {/* ── Window (left side of front face) ── */}
        <P d="M 54,521 L 104,546 L 104,596 L 54,571 Z" progress={pWindow} />

        {/* ── Door (center of front face, sits on ground line) ── */}
        <P d="M 126,598 L 171,621 L 171,721 L 126,698 Z" progress={pDoor} />

        {/* ── Left (front-facing) roof slope: D → Ridge-front → Ridge-back → G ── */}
        <P d="M 30,390 L 150,250 L 730,-40 L 610,100 Z" progress={pLeftRoof} />

        {/* ── Side face (extends off-screen right) ── */}
        <P d="M 270,770 L 850,480"  progress={pSideBot} />
        <P d="M 850,480 L 850,220"  progress={pSideRight} />
        <P d="M 270,510 L 610,100"  progress={pSideTop} />

        {/* ── Right roof slope: C → Ridge-front → Ridge-back → F ── */}
        <P d="M 270,510 L 150,250 L 730,-40 L 850,220" progress={pRightRoof} />
      </svg>
    </div>
  );
}
