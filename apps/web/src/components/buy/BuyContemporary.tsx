"use client";

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { ramp } from "@/lib/motion";
import { useIsMobile } from "@/hooks/useIsMobile";

// Corner positions measured from Uptown at 1440×900 viewport.
// topRight.cy pulled to 0.28 (from measured 0.12) to overlap with "OSE" of "CHOOSE".
// cx/cy = image CENTER as fraction of viewport. w/h = size as fraction of viewport.
const C = {
  topLeft:  { cx: 0.1095, cy: 0.3125, w: 0.1721, h: 0.3522 },
  topRight: { cx: 0.7375, cy: 0.28,   w: 0.1839, h: 0.3411 },
  btmLeft:  { cx: 0.1956, cy: 0.82,   w: 0.1631, h: 0.3326 },
  btmRight: { cx: 0.8694, cy: 0.79,   w: 0.1865, h: 0.3582 },
};

// Cluster positions — where images START (assembled contemporary view).
const K = {
  center: { cx: 0.5,     cy: 0.5     },
  left:   { cx: 0.39660, cy: 0.49215 },
  right:  { cx: 0.60341, cy: 0.49215 },
};

// Cluster display widths as fraction of viewport width.
const CW = { center: 0.24479, left: 0.17969, right: 0.17969 };

// Scale ratios: how much bigger each image is in the cluster vs its corner size.
const SC = {
  center: CW.center / C.topLeft.w,
  left:   CW.left   / C.btmLeft.w,
  right:  CW.right  / C.topRight.w,
  back:   CW.center / C.btmRight.w,
};

// Upright phones: corners two-by-two around "WHY CHOOSE CnC", images taller
// than wide like on desktop; cluster larger and centred for a narrow screen.
// Static corner boxes are set by the max-lg:portrait:! classes below and must
// match these cx/cy/w/h values (left = cx - w/2, top = cy - h/2).
const C_PHONE = {
  topLeft:  { cx: 0.27, cy: 0.20, w: 0.40, h: 0.22 },
  topRight: { cx: 0.73, cy: 0.26, w: 0.40, h: 0.22 },
  btmLeft:  { cx: 0.27, cy: 0.76, w: 0.40, h: 0.22 },
  btmRight: { cx: 0.73, cy: 0.82, w: 0.40, h: 0.22 },
};
const K_PHONE = { center: { cx: 0.5, cy: 0.5 }, left: { cx: 0.30, cy: 0.49 }, right: { cx: 0.70, cy: 0.49 } };
const CW_PHONE = { center: 0.62, left: 0.44, right: 0.44 };

type Move = { dx: number; dy: number; scale: number };

// Fly-in geometry: how far (as viewport fractions) and how much each image
// grows from its corner to its cluster spot. Desktop values are the original
// (K - C) offsets and SC ratios.
export function clusterGeometry(portraitPhone: boolean): Record<"ctr" | "lft" | "rgt" | "bck", Move> {
  if (!portraitPhone) {
    return {
      ctr: { dx: K.center.cx - C.topLeft.cx, dy: K.center.cy - C.topLeft.cy, scale: SC.center },
      lft: { dx: K.left.cx - C.btmLeft.cx, dy: K.left.cy - C.btmLeft.cy, scale: SC.left },
      rgt: { dx: K.right.cx - C.topRight.cx, dy: K.right.cy - C.topRight.cy, scale: SC.right },
      bck: { dx: K.center.cx - C.btmRight.cx, dy: K.center.cy - C.btmRight.cy, scale: SC.back },
    };
  }
  return {
    ctr: { dx: K_PHONE.center.cx - C_PHONE.topLeft.cx, dy: K_PHONE.center.cy - C_PHONE.topLeft.cy, scale: CW_PHONE.center / C_PHONE.topLeft.w },
    lft: { dx: K_PHONE.left.cx - C_PHONE.btmLeft.cx, dy: K_PHONE.left.cy - C_PHONE.btmLeft.cy, scale: CW_PHONE.left / C_PHONE.btmLeft.w },
    rgt: { dx: K_PHONE.right.cx - C_PHONE.topRight.cx, dy: K_PHONE.right.cy - C_PHONE.topRight.cy, scale: CW_PHONE.right / C_PHONE.topRight.w },
    bck: { dx: K_PHONE.center.cx - C_PHONE.btmRight.cx, dy: K_PHONE.center.cy - C_PHONE.btmRight.cy, scale: CW_PHONE.center / C_PHONE.btmRight.w },
  };
}

const FLOAT_ROWS = [
  { words: ["TRUST", "WORTHY"],  width: "90vw"  },
  { words: ["INNOV", "ATIVE"],   width: "97vw"  },
  { words: ["PROFES", "SIONAL"], width: "94vw"  },
];

// Returns absolute positioning style for an image centered at corner coordinates.
function pos(corner: typeof C.topLeft) {
  return {
    position: "absolute" as const,
    left: `calc(${corner.cx * 100}vw - ${corner.w * 50}vw)`,
    top:  `calc(${corner.cy * 100}vh - ${corner.h * 50}vh)`,
    width: `${corner.w * 100}vw`,
    height: `${corner.h * 100}vh`,
  };
}

// Hoisted to module scope — avoids re-allocating style objects on every render.
const POS_TOP_LEFT  = pos(C.topLeft);
const POS_TOP_RIGHT = pos(C.topRight);
const POS_BTM_LEFT  = pos(C.btmLeft);
const POS_BTM_RIGHT = pos(C.btmRight);

const OVERLAY_GRADIENT = "linear-gradient(to bottom, transparent 0%, #1B1B1B 80%)";

// Connector line paths — quadratic bezier arcs from each image's inner edge to logo center.
// Start = where the direct logo→image-center line crosses the image border.
// Control point = offset clockwise-perpendicular from midpoint, bowing all 4 arcs the same direction.
const LINE_PATHS = [
  "M 282,323 Q 556,327 720,470",   // topLeft  — right edge → logo
  "M 929,337 Q 864,468 720,470",   // topRight — left edge  → logo
  "M 400,666 Q 530,614 720,470",   // btmLeft  — right edge → logo
  "M 1118,650 Q 948,618 720,470",  // btmRight — left edge  → logo
];

// Animation timeline (400vh total, sticky pinned for first 300vh = p 0→0.75):
//   p 0.00          Start — images at 4 corners, WHY CHOOSE fully visible, no lines
//   p 0.00 → 0.45   Lines draw from each image edge toward logo center
//   p 0.20 → 0.45   WHY CHOOSE fades out as lines approach logo
//   p 0.45 → 0.70   Images fly from corners into cluster
//   p 0.50 → 0.72   RESULTS heading fades in
//   p 0.55 → 0.72   Watermark text fades in
//   p 0.72 → 0.75   Hold — cluster assembled, RESULTS visible
//   p 0.75 → 1.00   Sticky div naturally scrolls off (exit)

export function BuyContemporary() {
  const sectionRef = useRef<HTMLElement>(null);
  const vwRef = useRef(1440);
  const vhRef = useRef(900);
  // 1 on upright phones/iPads (matches the max-lg:portrait: CSS), 0 otherwise.
  const isMobile = useIsMobile();
  const portraitMV = useMotionValue(0);

  useEffect(() => {
    const onResize = () => {
      vwRef.current = window.innerWidth;
      vhRef.current = window.innerHeight;
      portraitMV.set(isMobile && window.innerHeight >= window.innerWidth ? 1 : 0);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile, portraitMV]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Each image flies from its corner to its cluster spot; offsets/scales come
  // from clusterGeometry (desktop values unchanged, portrait phones re-tuned).
  const geo = (m: number) => clusterGeometry(m === 1);

  // ── Center image: from top-left corner → cluster center ─────────────────────
  const ctrX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).ctr.dx * vwRef.current));
  const ctrY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).ctr.dy * vhRef.current));
  const ctrSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).ctr.scale));

  // ── Left image: from bottom-left corner → cluster left ──────────────────────
  const lftX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).lft.dx * vwRef.current));
  const lftY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).lft.dy * vhRef.current));
  const lftSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).lft.scale));
  const lftRot = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.70, 0, -3.5));

  // ── Right image: from top-right corner → cluster right ──────────────────────
  const rgtX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).rgt.dx * vwRef.current));
  const rgtY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).rgt.dy * vhRef.current));
  const rgtSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).rgt.scale));
  const rgtRot = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.70, 0, 3.5));

  // ── Back image: from bottom-right corner → cluster center (behind) ───────────
  const bckX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).bck.dx * vwRef.current));
  const bckY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).bck.dy * vhRef.current));
  const bckSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).bck.scale));

  // Gradient overlays: absent at corners, fade in as images cluster.
  const overlayOp = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.68, 0, 1));

  // RESULTS heading: invisible at start, fades in as cluster forms.
  const contemporaryOp = useTransform(scrollYProgress, (p) => ramp(p, 0.50, 0.68, 0, 1));

  // Watermark text: invisible at start, fades in as cluster forms.
  const floatOp = useTransform(scrollYProgress, (p) => ramp(p, 0.55, 0.70, 0, 0.12));

  // WHY CHOOSE CnC?: fully visible at start, fades out as lines reach logo.
  const whyOp = useTransform(scrollYProgress, (p) => ramp(p, 0.20, 0.45, 1, 0));

  // Lines draw in over first phase, then fade out as images start collapsing.
  const lineProgress = useTransform(scrollYProgress, [0, 0.45], [0, 1]);
  const lineOpacity  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.58, 1, 0));

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className="bg-[#1B1B1B] max-lg:portrait:!h-[300svh]"
      style={{ height: "400vh" }}
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-[#1B1B1B]">

        {/* Connector lines — draw in, then fade out as images collapse */}
        <motion.svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full max-lg:portrait:hidden"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden
          style={{ opacity: lineOpacity }}
        >
          {LINE_PATHS.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              stroke="white"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeLinecap="round"
              style={{ pathLength: lineProgress }}
            />
          ))}
        </motion.svg>

        {/* Watermark floating text */}
        <motion.div
          aria-hidden
          style={{ opacity: floatOp }}
          className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center"
        >
          {FLOAT_ROWS.map(({ words, width }, i) => (
            <div key={i} className="flex justify-between" style={{ width }}>
              {words.map((w) => (
                <span
                  key={w}
                  className="font-sans font-medium text-white"
                  style={{ fontSize: "clamp(2.5rem, 8vw, 10rem)" }}
                >
                  {w}
                </span>
              ))}
            </div>
          ))}
        </motion.div>

        {/* RESULTS heading */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 select-none text-center">
          <motion.h2
            style={{ opacity: contemporaryOp, fontSize: "clamp(2rem, 7vw, 10rem)" }}
            className="font-sans font-light leading-none text-white"
          >
            RESULTS
          </motion.h2>
        </div>

        {/* ── Center image → top-left corner ── */}
        <motion.div className="max-lg:portrait:!left-[7vw] max-lg:portrait:!top-[9vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]" style={{ ...POS_TOP_LEFT, x: ctrX, y: ctrY, scale: ctrSc, zIndex: 2 }}>
          <Image src="/images/contemporary/contemporary-01.jpg" fill className="object-cover" alt="" sizes="(max-width: 1023px) 62vw, 25vw" />
        </motion.div>

        {/* ── Right image → top-right corner (overlay shares parent transform) ── */}
        <motion.div className="max-lg:portrait:!left-[53vw] max-lg:portrait:!top-[15vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]" style={{ ...POS_TOP_RIGHT, x: rgtX, y: rgtY, scale: rgtSc, rotate: rgtRot, zIndex: 1 }}>
          <Image src="/images/contemporary/contemporary-02.jpg" fill className="object-cover" alt="" sizes="(max-width: 1023px) 44vw, 18vw" />
          <motion.div
            aria-hidden
            style={{ position: "absolute", inset: 0, opacity: overlayOp, background: OVERLAY_GRADIENT, pointerEvents: "none" }}
          />
        </motion.div>

        {/* ── Left image → bottom-left corner (overlay shares parent transform) ── */}
        <motion.div className="max-lg:portrait:!left-[7vw] max-lg:portrait:!top-[65vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]" style={{ ...POS_BTM_LEFT, x: lftX, y: lftY, scale: lftSc, rotate: lftRot, zIndex: 1 }}>
          <Image src="/images/contemporary/contemporary-03.jpg" fill className="object-cover" alt="" sizes="(max-width: 1023px) 44vw, 18vw" />
          <motion.div
            aria-hidden
            style={{ position: "absolute", inset: 0, opacity: overlayOp, background: OVERLAY_GRADIENT, pointerEvents: "none" }}
          />
        </motion.div>

        {/* ── Back image → bottom-right corner ── */}
        <motion.div className="max-lg:portrait:!left-[53vw] max-lg:portrait:!top-[71vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]" style={{ ...POS_BTM_RIGHT, x: bckX, y: bckY, scale: bckSc, zIndex: 0 }}>
          <Image src="/images/contemporary/contemporary-04.jpg" fill className="object-cover" alt="" sizes="(max-width: 1023px) 62vw, 18vw" />
        </motion.div>

        {/* WHY CHOOSE CnC? */}
        <motion.div
          style={{ opacity: whyOp, zIndex: 20 }}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <h2
            className="font-sans font-light leading-none text-white max-lg:landscape:!text-[clamp(1.6rem,9svh,2.5rem)]"
            style={{ fontSize: "clamp(2.5rem, 6vw, 7rem)" }}
          >
            WHY CHOOSE
            <span className="mt-6 flex justify-center">
              <Image
                src="/logo-mark.png"
                alt="CnC"
                width={612}
                height={370}
                style={{ height: "clamp(2.5rem, 6vw, 7rem)", width: "auto" }}
                className="object-contain"
              />
            </span>
          </h2>
          <p
            className="mt-10 max-w-md font-sans font-light leading-relaxed text-white/60 max-lg:mt-4 max-lg:px-8"
            style={{ fontSize: "clamp(0.875rem, 1.2vw, 1rem)" }}
          >
            With over 15+ years of California real estate expertise, our team is built to protect your interest and put your needs first
          </p>
        </motion.div>

      </div>
    </section>
  );
}
