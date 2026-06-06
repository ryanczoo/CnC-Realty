"use client";

import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";

// Corner positions from Uptown's 800×600 reference.
// cx/cy = image CENTER as fraction of viewport. w/h = size as fraction of viewport.
const C = {
  topLeft:  { cx: 0.10703, cy: 0.25452, w: 0.16823, h: 0.28680 }, // center img → top-left
  topRight: { cx: 0.74350, cy: 0.08790, w: 0.17969, h: 0.27778 }, // right img  → top-right
  btmLeft:  { cx: 0.19115, cy: 1.00958, w: 0.15938, h: 0.27083 }, // left img   → bottom-left
  btmRight: { cx: 0.87240, cy: 0.94417, w: 0.18229, h: 0.29167 }, // back img   → bottom-right
};

// Contemporary cluster centers as fraction of viewport
const K = {
  center: { cx: 0.5,       cy: 0.5      },
  left:   { cx: 0.39660,   cy: 0.49215  },
  right:  { cx: 0.60341,   cy: 0.49215  },
};

// Contemporary widths as fraction of viewport width (for scale ratio)
const CW = { center: 0.24479, left: 0.17969, right: 0.17969 };

const FLOAT_ROWS = [
  { words: ["TRUST", "WORTHY"],   width: "90vw"  },
  { words: ["INNOV", "ATIVE"],    width: "97vw"  },
  { words: ["PROFES", "SIONAL"],  width: "112vw" },
];

function ramp(p: number, lo: number, hi: number, a: number, b: number) {
  const t = Math.max(0, Math.min(1, (p - lo) / (hi - lo)));
  return a + (b - a) * t;
}

// Returns inline style for an image positioned by its center at corner coordinates
function pos(corner: typeof C.topLeft) {
  return {
    position: "absolute" as const,
    left: `calc(${corner.cx * 100}vw - ${corner.w * 50}vw)`,
    top:  `calc(${corner.cy * 100}vh - ${corner.h * 50}vh)`,
    width: `${corner.w * 100}vw`,
    height: `${corner.h * 100}vh`,
  };
}

export function BuyContemporary() {
  const sectionRef = useRef<HTMLElement>(null);
  const vwRef = useRef(1440);
  const vhRef = useRef(900);

  useEffect(() => {
    const onResize = () => {
      vwRef.current = window.innerWidth;
      vhRef.current = window.innerHeight;
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // ── Center image → top-left corner ──────────────────────────────────────
  const ctrX = useTransform(scrollYProgress, (p) => {
    const dx = (K.center.cx - C.topLeft.cx) * vwRef.current;
    return ramp(p, 0.45, 0.85, dx, 0);
  });
  const ctrY = useTransform(scrollYProgress, (p) => {
    const dy = (K.center.cy - C.topLeft.cy) * vhRef.current;
    if (p < 0.45) return dy + vhRef.current * 0.15 * (1 - ramp(p, 0.05, 0.45, 0, 1));
    return ramp(p, 0.45, 0.85, dy, 0);
  });
  const ctrSc = useTransform(scrollYProgress, (p) => {
    const sc = CW.center / C.topLeft.w; // ≈1.455
    if (p < 0.45) return ramp(p, 0.05, 0.45, 0.78 * sc, sc);
    return ramp(p, 0.45, 0.85, sc, 1);
  });

  // ── Left image → bottom-left corner ─────────────────────────────────────
  const lftX = useTransform(scrollYProgress, (p) => {
    const dx = (K.left.cx - C.btmLeft.cx) * vwRef.current;
    if (p < 0.45) return dx - vwRef.current * 0.08 * (1 - ramp(p, 0.05, 0.45, 0, 1));
    return ramp(p, 0.45, 0.85, dx, 0);
  });
  const lftY = useTransform(scrollYProgress, (p) => {
    const dy = (K.left.cy - C.btmLeft.cy) * vhRef.current;
    if (p < 0.45) return dy + vhRef.current * 0.30 * (1 - ramp(p, 0.05, 0.45, 0, 1));
    return ramp(p, 0.45, 0.85, dy, 0);
  });
  const lftSc  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.85, CW.left / C.btmLeft.w, 1));
  const lftOp  = useTransform(scrollYProgress, (p) => ramp(p, 0.05, 0.30, 0, 1));
  const lftRot = useTransform(scrollYProgress, (p) => {
    if (p < 0.45) return ramp(p, 0.05, 0.45, -7, -3.5);
    return ramp(p, 0.45, 0.85, -3.5, 0);
  });

  // ── Right image → top-right corner ──────────────────────────────────────
  const rgtX = useTransform(scrollYProgress, (p) => {
    const dx = (K.right.cx - C.topRight.cx) * vwRef.current;
    if (p < 0.45) return dx + vwRef.current * 0.08 * (1 - ramp(p, 0.05, 0.45, 0, 1));
    return ramp(p, 0.45, 0.85, dx, 0);
  });
  const rgtY = useTransform(scrollYProgress, (p) => {
    const dy = (K.right.cy - C.topRight.cy) * vhRef.current;
    if (p < 0.45) return dy + vhRef.current * 0.30 * (1 - ramp(p, 0.05, 0.45, 0, 1));
    return ramp(p, 0.45, 0.85, dy, 0);
  });
  const rgtSc  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.85, CW.right / C.topRight.w, 1));
  const rgtOp  = useTransform(scrollYProgress, (p) => ramp(p, 0.05, 0.30, 0, 1));
  const rgtRot = useTransform(scrollYProgress, (p) => {
    if (p < 0.45) return ramp(p, 0.05, 0.45, 7, 3.5);
    return ramp(p, 0.45, 0.85, 3.5, 0);
  });

  // ── Back image → bottom-right corner ────────────────────────────────────
  const bckX  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.85, (K.center.cx - C.btmRight.cx) * vwRef.current, 0));
  const bckY  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.85, (K.center.cy - C.btmRight.cy) * vhRef.current, 0));
  const bckSc = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.85, CW.center / C.btmRight.w, 1)); // ≈1.343→1
  const bckOp = useTransform(scrollYProgress, (p) => ramp(p, 0.50, 0.75, 0, 1));

  // ── Side-image gradient overlay: fades IN with the image, then OUT during expansion ──
  const overlayOp = useTransform(scrollYProgress, (p) =>
    ramp(p, 0.05, 0.30, 0, 1) * ramp(p, 0.45, 0.70, 1, 0),
  );

  // ── UI ────────────────────────────────────────────────────────────────────
  const contemporaryOp = useTransform(scrollYProgress, (p) =>
    p < 0.40 ? ramp(p, 0.05, 0.20, 0, 1) : ramp(p, 0.40, 0.58, 1, 0),
  );
  const floatOp = useTransform(scrollYProgress, (p) =>
    p < 0.30 ? ramp(p, 0.05, 0.30, 0, 0.12) : ramp(p, 0.30, 0.50, 0.12, 0),
  );
  const whyOp = useTransform(scrollYProgress, (p) => ramp(p, 0.70, 0.90, 0, 1));
  const whyY  = useTransform(scrollYProgress, (p) => ramp(p, 0.70, 0.90, 28, 0));

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      style={{ height: "200vh" }}
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-[#1B1B1B]">

        {/* Watermark floating text */}
        <motion.div
          aria-hidden
          style={{ opacity: floatOp }}
          className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center"
        >
          {FLOAT_ROWS.map(({ words, width }, i) => (
            <div key={i} className="flex justify-between" style={{ width }}>
              {words.map((w) => (
                <span key={w} className="font-sans font-medium text-white" style={{ fontSize: "clamp(2.5rem, 8vw, 10rem)" }}>
                  {w}
                </span>
              ))}
            </div>
          ))}
        </motion.div>

        {/* CONTEMPORARY heading — outer div owns position+translate, motion owns only opacity */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 select-none text-center">
          <motion.h2
            style={{ opacity: contemporaryOp, fontSize: "clamp(2rem, 7vw, 10rem)" }}
            className="font-sans font-medium leading-none text-white"
          >
            CONTEMPORARY
          </motion.h2>
        </div>

        {/* ── Center image → top-left corner ── */}
        <motion.div style={{ ...pos(C.topLeft), x: ctrX, y: ctrY, scale: ctrSc, zIndex: 2 }}>
          <Image src="/images/buy/buy-step-01.jpg" fill className="object-cover" alt="" sizes="25vw" />
        </motion.div>

        {/* ── Right image → top-right corner ── */}
        <motion.div style={{ ...pos(C.topRight), x: rgtX, y: rgtY, scale: rgtSc, rotate: rgtRot, opacity: rgtOp, zIndex: 1 }}>
          <Image src="/images/buy/buy-step-02.jpg" fill className="object-cover" alt="" sizes="18vw" />
        </motion.div>
        {/* Right image gradient overlay (independent opacity) */}
        <motion.div
          aria-hidden
          style={{
            ...pos(C.topRight),
            x: rgtX, y: rgtY, scale: rgtSc, rotate: rgtRot,
            opacity: overlayOp,
            background: "linear-gradient(to bottom, transparent 0%, #1B1B1B 80%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* ── Left image → bottom-left corner ── */}
        <motion.div style={{ ...pos(C.btmLeft), x: lftX, y: lftY, scale: lftSc, rotate: lftRot, opacity: lftOp, zIndex: 1 }}>
          <Image src="/images/buy/buy-step-03.jpg" fill className="object-cover" alt="" sizes="18vw" />
        </motion.div>
        {/* Left image gradient overlay */}
        <motion.div
          aria-hidden
          style={{
            ...pos(C.btmLeft),
            x: lftX, y: lftY, scale: lftSc, rotate: lftRot,
            opacity: overlayOp,
            background: "linear-gradient(to bottom, transparent 0%, #1B1B1B 80%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* ── Back image → bottom-right corner ── */}
        <motion.div style={{ ...pos(C.btmRight), x: bckX, y: bckY, scale: bckSc, opacity: bckOp, zIndex: 0 }}>
          <Image src="/images/buy/buy-step-04.jpg" fill className="object-cover" alt="" sizes="18vw" />
        </motion.div>

        {/* WHY CHOOSE CnC? content */}
        <motion.div
          style={{ opacity: whyOp, y: whyY, zIndex: 20 }}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <h2
            className="font-sans font-medium leading-tight text-white"
            style={{ fontSize: "clamp(2.5rem, 6vw, 7rem)" }}
          >
            WHY CHOOSE
            <br />
            <span className="text-cnc-gold">CnC?</span>
          </h2>
          <p
            className="mt-6 max-w-md font-sans font-light leading-relaxed text-white/60"
            style={{ fontSize: "clamp(0.875rem, 1.2vw, 1rem)" }}
          >
            With 15+ years of California real estate expertise, our team is built to protect your interests at every step.
          </p>
        </motion.div>

      </div>
    </section>
  );
}
