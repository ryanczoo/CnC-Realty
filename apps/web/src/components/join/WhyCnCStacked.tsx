"use client";

import { ReactNode, useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";

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

function CardContent({ row }: { row: Row }) {
  return (
    <div
      className="flex h-full"
      style={{ backgroundColor: row.bg, flexDirection: row.imgSide === "left" ? "row" : "row-reverse" }}
    >
      <div className="relative w-1/2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={row.img} alt={row.label} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div
        className="flex w-1/2 flex-col justify-between p-10 lg:p-16"
        style={{ backgroundColor: row.textBg }}
      >
        <h3
          className="font-sans text-[2.5rem] font-semibold uppercase tracking-widest leading-tight"
          style={{ color: row.textColor }}
        >
          {row.label}
        </h3>
        <p
          className="max-w-lg font-sans text-[1.25rem] font-light leading-relaxed"
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

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  const cardH = vh * 0.52; // card height in px (matches height: "52vh")

  // Both cards start the same distance below their stacked position:
  // exactly at the bottom edge of the card above them once stacked.
  const slideDistance = cardH - OFFSET; // e.g. 416 - 88 = 328px

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
              className="absolute left-6 right-6 overflow-hidden rounded-2xl"
              style={{ top: BASE, height: "52vh" }}
            >
              <CardContent row={ROWS[0]} />
            </div>

            {/* Card 2 — slides up from below card 1 during phase 1 */}
            <motion.div
              className="absolute left-6 right-6 overflow-hidden rounded-2xl"
              style={{ top: BASE + OFFSET, y: card2Y, height: "52vh" }}
            >
              <CardContent row={ROWS[1]} />
            </motion.div>

            {/* Card 3 — follows card 2's bottom in phase 1, stacks in phase 2 */}
            <motion.div
              className="absolute left-6 right-6 overflow-hidden rounded-2xl"
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
