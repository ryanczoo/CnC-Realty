"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";

function P({ d, progress }: { d: string; progress: MotionValue<number> }) {
  return (
    <motion.path
      d={d}
      stroke="#9E8C61"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      style={{ opacity: 0.22 }}
      pathLength={progress}
    />
  );
}

// Contemporary FLAT-ROOF house — mirrored so front face is on the RIGHT side.
// Depth extends off to the LEFT, keeping the house visible behind the bio column.
// No gable, no ridge. Features: flat roof surface + parapet lip, 3 floor-to-ceiling
// window panels, narrow modern door, horizontal side-face strip window, roof chimney.
//
// Oblique projection mirrored: horizontal axis (-1,0.5), depth axis (-1,-0.5).
// All x-coords = 1440 − original_x.
//
// Front face (wide, low — right side of viewBox):
//   D'(1320,250) top-right   C'(820,500) top-left
//   A'(1320,630) bot-right   B'(820,880) bot-left [bleeds off bottom]
// Depth 900 → G'(420,-200) F'(-80,50)  [both off-screen left]
// Parapet: 40px above top edge → D_p'(1320,210) C_p'(820,460)
export function AgentAboutLineArt() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const pFrontLeft    = useTransform(scrollYProgress, [0.00, 0.22], [0, 1]);
  const pFrontBot     = useTransform(scrollYProgress, [0.04, 0.26], [0, 1]);
  const pFrontRight   = useTransform(scrollYProgress, [0.08, 0.30], [0, 1]);
  const pFrontTop     = useTransform(scrollYProgress, [0.12, 0.34], [0, 1]);
  const pParapetFront = useTransform(scrollYProgress, [0.16, 0.38], [0, 1]);
  const pParapetSide  = useTransform(scrollYProgress, [0.20, 0.42], [0, 1]);
  const pRoof         = useTransform(scrollYProgress, [0.24, 0.46], [0, 1]);
  const pSideBot      = useTransform(scrollYProgress, [0.28, 0.50], [0, 1]);
  const pWin1         = useTransform(scrollYProgress, [0.32, 0.54], [0, 1]);
  const pWin1Div      = useTransform(scrollYProgress, [0.36, 0.58], [0, 1]);
  const pWin2         = useTransform(scrollYProgress, [0.38, 0.60], [0, 1]);
  const pWin2Div      = useTransform(scrollYProgress, [0.42, 0.64], [0, 1]);
  const pWin3         = useTransform(scrollYProgress, [0.44, 0.66], [0, 1]);
  const pWin3Div      = useTransform(scrollYProgress, [0.48, 0.70], [0, 1]);
  const pDoor         = useTransform(scrollYProgress, [0.50, 0.72], [0, 1]);
  const pSideWin      = useTransform(scrollYProgress, [0.54, 0.76], [0, 1]);
  const pChimFront    = useTransform(scrollYProgress, [0.58, 0.80], [0, 1]);
  const pChimRight    = useTransform(scrollYProgress, [0.62, 0.84], [0, 1]);
  const pChimTop      = useTransform(scrollYProgress, [0.66, 0.88], [0, 1]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden>
      <svg
        viewBox="0 0 1440 900"
        overflow="visible"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {/* ── Front face walls (right side of viewBox) ── */}
        <P d="M 1320,630 L 1320,250"  progress={pFrontLeft} />
        <P d="M 1320,630 L 820,880"   progress={pFrontBot} />
        <P d="M 820,880 L 820,500"    progress={pFrontRight} />
        <P d="M 1320,250 L 820,500"   progress={pFrontTop} />

        {/* ── Flat-roof parapet: 40px lip, extends back off-screen left ── */}
        <P d="M 1320,210 L 820,460"         progress={pParapetFront} />
        <P d="M 820,460 L -80,10"           progress={pParapetSide} />

        {/* ── Flat roof surface (parallelogram going off top + left) ── */}
        <P d="M 1320,250 L 820,500 L -80,50 L 420,-200 Z" progress={pRoof} />

        {/* ── Side face bottom edge (bleeds off left) ── */}
        <P d="M 820,880 L -80,430"          progress={pSideBot} />

        {/* ── Window 1 — right-side floor-to-ceiling panel + H-divider ── */}
        <P d="M 1295,293 L 1180,350 L 1180,670 L 1295,612 Z" progress={pWin1} />
        <P d="M 1295,453 L 1180,510"                          progress={pWin1Div} />

        {/* ── Window 2 — center floor-to-ceiling panel + H-divider ── */}
        <P d="M 1135,373 L 1020,430 L 1020,750 L 1135,692 Z" progress={pWin2} />
        <P d="M 1135,533 L 1020,590"                          progress={pWin2Div} />

        {/* ── Window 3 — left-side floor-to-ceiling panel + H-divider ── */}
        <P d="M 975,453 L 860,510 L 860,830 L 975,772 Z"     progress={pWin3} />
        <P d="M 975,613 L 860,670"                            progress={pWin3Div} />

        {/* ── Narrow modern door between panels 2 and 3 ── */}
        <P d="M 1010,576 L 985,589 L 985,767 L 1010,755 Z"   progress={pDoor} />

        {/* ── Side face horizontal strip window (depth 100→650, left side) ── */}
        <P d="M 720,507 L 170,232 L 170,346 L 720,621 Z"     progress={pSideWin} />

        {/* ── Rectangular chimney on flat roof (3 visible faces) ── */}
        <P d="M 1130,250 L 1130,170 L 1100,185 L 1100,265 Z" progress={pChimFront} />
        <P d="M 1100,265 L 1080,255 L 1080,175 L 1100,185 Z" progress={pChimRight} />
        <P d="M 1130,170 L 1100,185 L 1080,175 L 1110,160 Z" progress={pChimTop} />
      </svg>
    </div>
  );
}
