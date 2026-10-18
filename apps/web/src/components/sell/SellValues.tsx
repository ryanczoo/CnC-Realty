"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { useIsMobile } from "@/hooks/useIsMobile";
import { pinnedPanelHeight } from "@/lib/pinned-panel";

const SPREAD = 30; // degrees between adjacent cards
const WR_START =  2 * SPREAD; //  60 — card[0] at center when scroll=0
const WR_END   = -2 * SPREAD; // -60 — card[4] at center when scroll=1

const VALUES = [
  { label: "Respect",             img: "/images/sell/values-respect.jpg" },
  { label: "Punctuality",         img: "/images/sell/values-punctuality.jpg" },
  { label: "Attention to Detail", img: "/images/sell/values-attention.jpg" },
  { label: "Compassion",          img: "/images/sell/values-compassion.jpg" },
  { label: "Integrity",           img: "/images/sell/values-integrity.jpg" },
];

// Sideways phones: cards drawn this much smaller (from their own centre) so the
// neighbouring cards' top edges clear the "Our Values" title.
export const SIDEWAYS_CARD_SCALE = 0.88;

export function cardVars(i: number, t: number, mobile: boolean, panelH: number, sideways = false) {
  const R       = mobile ? 360 : 660;
  const CW      = mobile ? 160 : 300;
  const CH      = mobile ? 208 : 390;

  const wr       = WR_START + t * (WR_END - WR_START);
  const angleDeg = 270 + (i - 2) * SPREAD + wr;
  const angleRad = angleDeg * (Math.PI / 180);

  // Circle center offset from panel center (px, CSS y-down)
  const CY = panelH * 0.15 - R;

  // Card top-left offset from panel center (Framer Motion x/y on top of left:50% top:50%)
  const x = R * Math.cos(angleRad) - CW / 2;
  const y = CY - R * Math.sin(angleRad) - CH / 2;

  // Distance from active position (270°), normalised by SPREAD
  const raw  = ((angleDeg % 360) + 360) % 360;
  const dist = Math.min(Math.abs(raw - 270), 360 - Math.abs(raw - 270));
  const frac = Math.min(dist / SPREAD, 2);

  return {
    x,
    y,
    scale:   Math.max(0.64, 1 - frac * 0.18) * (mobile && sideways ? SIDEWAYS_CARD_SCALE : 1),
    opacity: Math.max(0.42, 1 - frac * 0.29),
    rotate:  (angleDeg - 270) * 0.42,
  };
}

export function SellValues() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // 1 on phones/upright iPads, 0 on desktop. A motion value (not a plain
  // closure) so the cards recompute the instant the helper flips — after
  // hydration and on iPad rotation — without waiting for a scroll.
  const isMobile = useIsMobile();
  const mobileMV = useMotionValue(isMobile ? 1 : 0);
  useEffect(() => { mobileMV.set(isMobile ? 1 : 0); }, [isMobile, mobileMV]);

  // Phones only: the pinned panel's own height (steady while the address bar slides)
  // and whether the phone is sideways. Re-measured on rotation. Desktop leaves both at 0.
  const panelRef = useRef<HTMLDivElement>(null);
  const panelHMV = useMotionValue(0);
  const sidewaysMV = useMotionValue(0);
  useEffect(() => {
    if (!isMobile) {
      panelHMV.set(0);
      sidewaysMV.set(0);
      return;
    }
    const measure = () => {
      panelHMV.set(panelRef.current?.clientHeight ?? 0);
      sidewaysMV.set(window.innerHeight < window.innerWidth ? 1 : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isMobile, panelHMV, sidewaysMV]);

  const inputs = [scrollYProgress, mobileMV, sidewaysMV, panelHMV];
  const panelH = (m: number, h: number) =>
    pinnedPanelHeight(m === 1, h, typeof window !== "undefined" ? window.innerHeight : 900);

  // 25 motion values: 5 cards × {x, y, scale, opacity, rotate}
  // Declared at top level — hooks cannot live in loops
  const x0  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(0, t, m === 1, panelH(m, h), s === 1).x);
  const y0  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(0, t, m === 1, panelH(m, h), s === 1).y);
  const s0  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(0, t, m === 1, panelH(m, h), s === 1).scale);
  const o0  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(0, t, m === 1, panelH(m, h), s === 1).opacity);
  const ro0 = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(0, t, m === 1, panelH(m, h), s === 1).rotate);

  const x1  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(1, t, m === 1, panelH(m, h), s === 1).x);
  const y1  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(1, t, m === 1, panelH(m, h), s === 1).y);
  const s1  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(1, t, m === 1, panelH(m, h), s === 1).scale);
  const o1  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(1, t, m === 1, panelH(m, h), s === 1).opacity);
  const ro1 = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(1, t, m === 1, panelH(m, h), s === 1).rotate);

  const x2  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(2, t, m === 1, panelH(m, h), s === 1).x);
  const y2  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(2, t, m === 1, panelH(m, h), s === 1).y);
  const s2  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(2, t, m === 1, panelH(m, h), s === 1).scale);
  const o2  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(2, t, m === 1, panelH(m, h), s === 1).opacity);
  const ro2 = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(2, t, m === 1, panelH(m, h), s === 1).rotate);

  const x3  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(3, t, m === 1, panelH(m, h), s === 1).x);
  const y3  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(3, t, m === 1, panelH(m, h), s === 1).y);
  const s3  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(3, t, m === 1, panelH(m, h), s === 1).scale);
  const o3  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(3, t, m === 1, panelH(m, h), s === 1).opacity);
  const ro3 = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(3, t, m === 1, panelH(m, h), s === 1).rotate);

  const x4  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(4, t, m === 1, panelH(m, h), s === 1).x);
  const y4  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(4, t, m === 1, panelH(m, h), s === 1).y);
  const s4  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(4, t, m === 1, panelH(m, h), s === 1).scale);
  const o4  = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(4, t, m === 1, panelH(m, h), s === 1).opacity);
  const ro4 = useTransform(inputs, ([t, m, s, h]: number[]) => cardVars(4, t, m === 1, panelH(m, h), s === 1).rotate);

  const MOTION = [
    { x: x0, y: y0, scale: s0, opacity: o0, rotate: ro0 },
    { x: x1, y: y1, scale: s1, opacity: o1, rotate: ro1 },
    { x: x2, y: y2, scale: s2, opacity: o2, rotate: ro2 },
    { x: x3, y: y3, scale: s3, opacity: o3, rotate: ro3 },
    { x: x4, y: y4, scale: s4, opacity: o4, rotate: ro4 },
  ];

  return (
    <section ref={sectionRef} className="relative max-lg:!h-[300svh]" style={{ height: "500vh" }}>
      {/* Sticky panel */}
      <div ref={panelRef} className="sticky top-0 h-screen overflow-hidden bg-cnc-bg">

        {/* Title — top center, same pattern as "Our Process". Sideways phones: 40px higher
            so the (slightly smaller) cards clear it. */}
        <div className="absolute inset-x-0 top-40 flex justify-center max-lg:top-24 max-lg:landscape:top-14">
          <h2 className="font-sans text-[3.5rem] font-light xl:text-[4.5rem] max-lg:text-[clamp(2.2rem,9vw,3.5rem)]">
            <RevealLine>
              <span className="text-[2.6rem] xl:text-[3.4rem] max-lg:text-[clamp(1.7rem,7vw,2.6rem)]">Our </span>
              <span style={{ color: "#9E8C61", fontWeight: 500 }}>Values</span>
            </RevealLine>
          </h2>
        </div>

        {/* Arc guide lines — two faint concentric ellipses */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden
        >
          <ellipse cx="720" cy="-75" rx="660" ry="660"
            stroke="#1B1B1B" strokeOpacity="0.07" strokeWidth="1" />
          <ellipse cx="720" cy="-75" rx="460" ry="460"
            stroke="#1B1B1B" strokeOpacity="0.07" strokeWidth="1" />
        </svg>

        {/* Cards */}
        {VALUES.map((v, i) => (
          <motion.div
            key={v.label}
            className="absolute overflow-hidden rounded-2xl shadow-md
                       w-[160px] h-[208px] lg:w-[300px] lg:h-[390px]"
            style={{
              left: "50%",
              top: "50%",
              x: MOTION[i].x,
              y: MOTION[i].y,
              scale: MOTION[i].scale,
              opacity: MOTION[i].opacity,
              rotate: MOTION[i].rotate,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.img}
              alt={v.label}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="px-4 text-center font-sans text-[2.2rem] font-light leading-tight text-white lg:text-[2.6rem] max-lg:px-2 max-lg:text-[1.3rem]">
                {v.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
