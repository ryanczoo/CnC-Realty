"use client";

import { ReactNode, useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useIsMobile } from "@/hooks/useIsMobile";

const G = ({ children }: { children: ReactNode }) => (
  <span style={{ color: "#9E8C61" }}>{children}</span>
);

type Row = {
  label: string;
  body: ReactNode;
  img: string;
  imgSide: "left" | "right";
  bg: string;
  textBg: string;
  textColor: string;
};

const ROWS: Row[] = [
  {
    label: "Dare to Dream",
    body: <>Our cloud-based brokerage system is how we are able to provide <G>everything</G> you need, and <G>nothing</G> you don't. Become the master of your domain wherever and whenever you go by not being bound by an office area location.</>,
    img: "/images/join-agent.jpg",
    imgSide: "right",
    bg: "#F2F0EF",
    textBg: "#1B1B1B",
    textColor: "#FFFFFF",
  },
  {
    label: "Tools for Success",
    body: <>With the help of AI, CnC has created a <G>full transaction management system</G> to provide agents with the ability to track the lifespan of their real estate deals and a <G>custom CRM software</G> to show lead tracking with automatic scoring, activity feed by potential clients, and a pipeline Kanban board – <G>FREE!</G></>,
    img: "/images/join-crm.png",
    imgSide: "left",
    bg: "#ECEAE7",
    textBg: "#FFFFFF",
    textColor: "#1B1B1B",
  },
  {
    label: "Beyond the Brand",
    body: <>CnC is more than just a name, its a <G>community</G> of like-minded professionals helping each other grow. Join a culture that makes you feel at home and always striving for <G>success</G>. Our mentorship program and network promotes communication versus isolation so you are never feeling alone.</>,
    img: "/images/join-community.jpg",
    imgSide: "right",
    bg: "#1B1B1B",
    textBg: "#1B1B1B",
    textColor: "#FFFFFF",
  },
];

// Pixel offset between stacked cards and top of first card (clears the navbar)
const BASE = 80;
const OFFSET = 88;

// Phones stack with a tighter offset (and sideways phones a shorter card) so
// the third card's bottom stays on screen: desktop 80 + 2*88 + 52vh fits a
// 900px screen but runs ~70px below a sideways phone's. Static tops are set by
// the max-lg:!top-* classes below and must match these offsets (base 64px).
export type StackMode = "desktop" | "portrait" | "landscape";
export function stackGeometry(vh: number, mode: StackMode): { offset: number; cardH: number } {
  if (mode === "desktop") return { offset: OFFSET, cardH: vh * 0.52 };
  return { offset: 40, cardH: vh * (mode === "landscape" ? 0.48 : 0.52) };
}

function CardContent({ row }: { row: Row }) {
  return (
    <div
      className="flex h-full max-lg:portrait:relative"
      style={{ backgroundColor: row.bg, flexDirection: row.imgSide === "left" ? "row" : "row-reverse" }}
    >
      <div className="relative w-1/2 overflow-hidden max-lg:portrait:!absolute max-lg:portrait:inset-0 max-lg:portrait:w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={row.img} alt={row.label} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div
        className="flex w-1/2 flex-col justify-between p-10 lg:p-16 max-lg:p-4 max-lg:portrait:relative max-lg:portrait:w-full max-lg:portrait:!bg-black/55 max-lg:portrait:p-5"
        style={{ backgroundColor: row.textBg }}
      >
        <h3
          className="font-sans text-[2.5rem] font-semibold uppercase tracking-widest leading-tight max-lg:tracking-wide max-lg:portrait:!text-white max-lg:portrait:text-[clamp(1.2rem,6vw,2rem)] max-lg:landscape:text-[clamp(0.9rem,5svh,1.6rem)]"
          style={{ color: row.textColor }}
        >
          {row.label}
        </h3>
        <p
          className="max-w-lg font-sans text-[1.25rem] font-light leading-relaxed max-lg:portrait:!text-white max-lg:portrait:text-[clamp(0.85rem,3.8vw,1.05rem)] max-lg:landscape:text-[clamp(0.65rem,3.3svh,0.95rem)] max-lg:landscape:leading-snug"
          style={{ color: row.textColor }}
        >
          {row.body}
        </p>
      </div>
    </div>
  );
}

export function WhyCnCStacked() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(800);
  const [mode, setMode] = useState<StackMode>("desktop");
  const isMobile = useIsMobile();

  useEffect(() => {
    const update = () => {
      setVh(window.innerHeight);
      setMode(!isMobile ? "desktop" : window.innerHeight >= window.innerWidth ? "portrait" : "landscape");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isMobile]);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  // Card height in px (matches height: "52vh"; 48vh on sideways phones).
  const { offset, cardH } = stackGeometry(vh, mode);

  // Both cards start the same distance below their stacked position:
  // exactly at the bottom edge of the card above them once stacked.
  const slideDistance = cardH - offset; // desktop e.g. 416 - 88 = 328px

  // Phase 1 [0 → 0.5]: card 2 slides up from just below card 1's stacked bottom
  const card2Y = useTransform(scrollYProgress, [0, 0.5], [slideDistance, 0]);

  // Card 3 follows card 2's bottom during phase 1, then stacks over card 2 in phase 2
  const card3Y = useTransform(scrollYProgress, [0, 0.5, 1.0], [slideDistance * 2, slideDistance, 0]);

  return (
    <section className="bg-cnc-bg" style={{ marginBottom: "-110px" }}>
      {/* Scroll driver — 200vh: 100vh per stacking phase, no exit animation */}
      <div ref={scrollRef} style={{ height: "200vh" }}>
        <div className="sticky top-0 h-screen overflow-hidden bg-cnc-bg">
          <div className="relative h-full">

            {/* Card 1 — fixed at base position */}
            <div
              className="absolute left-6 right-6 overflow-hidden rounded-2xl max-lg:!top-[64px] max-lg:left-4 max-lg:right-4 max-lg:landscape:!h-[48vh]"
              style={{ top: BASE, height: "52vh" }}
            >
              <CardContent row={ROWS[0]} />
            </div>

            {/* Card 2 — slides up from below card 1 during phase 1 */}
            <motion.div
              className="absolute left-6 right-6 overflow-hidden rounded-2xl max-lg:!top-[104px] max-lg:left-4 max-lg:right-4 max-lg:landscape:!h-[48vh]"
              style={{ top: BASE + OFFSET, y: card2Y, height: "52vh" }}
            >
              <CardContent row={ROWS[1]} />
            </motion.div>

            {/* Card 3 — follows card 2's bottom in phase 1, stacks in phase 2 */}
            <motion.div
              className="absolute left-6 right-6 overflow-hidden rounded-2xl max-lg:!top-[144px] max-lg:left-4 max-lg:right-4 max-lg:landscape:!h-[48vh]"
              style={{ top: BASE + OFFSET * 2, y: card3Y, height: "52vh" }}
            >
              <CardContent row={ROWS[2]} />
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}
