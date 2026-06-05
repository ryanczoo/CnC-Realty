"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useScroll } from "motion/react";
import Image from "next/image";
import { useScrollStepper } from "@/hooks/useScrollStepper";
import { RevealLine } from "@/components/ui/reveal-text";

// Each title: first word smaller, optional middle words normal, last word gold.
// Matches the "Our Process" / "Our Values" two-tier title pattern.
const STEPS = [
  {
    title: { first: "Get", mid: "", last: "Pre-Approved" },
    body: "Connect with a lender to understand your budget before you fall in love with a home. Our agents can refer you to trusted local lenders.",
    img: "/images/sell/sell-06.jpg",
  },
  {
    title: { first: "Find", mid: "Your", last: "Agent" },
    body: "Every CnC agent is a local California expert. Match with someone who knows your target neighborhoods inside and out.",
    img: "/images/sell/sell-07.jpg",
  },
  {
    title: { first: "Search", mid: "&", last: "Tour" },
    body: "Browse live CRMLS listings updated every 15 minutes. Schedule tours directly and move fast when the right home appears.",
    img: "/images/sell/sell-08.jpg",
  },
  {
    title: { first: "Closing", mid: "", last: "Escrow" },
    body: "From offer to keys, your CnC agent handles the contracts, negotiations, inspections, and escrow — so you can focus on the move.",
    img: "/images/sell/sell-09.jpg",
  },
];

export function BuySteps() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const { activeIdx, barWidths } = useScrollStepper(scrollYProgress, STEPS.length);
  const active = STEPS[activeIdx];

  return (
    <section ref={sectionRef} className="relative flex bg-[#F2F0EF] pl-20 pr-8">

      {/* ── Left panel — sticky ── */}
      <div className="sticky top-[100px] flex h-[68vh] w-[42%] flex-col justify-between self-start pb-12 pt-10">

        {/* TOP — step heading with Our-Process-style two-tier title + RevealLine */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={`title-${activeIdx}`}
            className="font-sans text-[3.2rem] font-light leading-[1.0] xl:text-[3.8rem]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.55, ease: "easeOut" } }}
            exit={{ opacity: 0, y: -30, transition: { duration: 0.35, ease: "easeIn" } }}
          >
            {/* triggerOnMount because this is always in-view inside AnimatePresence */}
            <RevealLine triggerOnMount>
              <span className="text-[2.4rem] xl:text-[2.9rem]">{active.title.first} {active.title.mid && `${active.title.mid} `}</span>
              <span style={{ color: "#9E8C61" }}>{active.title.last}</span>
            </RevealLine>
          </motion.h2>
        </AnimatePresence>

        {/* BOTTOM — counter then body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`body-${activeIdx}`}
            className="flex flex-col gap-1"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.35, ease: "easeIn" } }}
          >
            <p className="font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">
              {String(activeIdx + 1).padStart(2, "0")} / 04
            </p>
            <p className="max-w-sm font-sans text-[0.95rem] leading-relaxed text-[#1B1B1B]/60">
              {active.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Progress bar — between panels ── */}
      <div className="sticky top-[100px] flex h-[68vh] w-8 flex-col items-start self-start py-10">
        <div className="flex h-full w-[2px] flex-col gap-[3px]">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 overflow-hidden"
              style={{ backgroundColor: "rgba(27,27,27,0.12)" }}
            >
              <div
                className="w-full bg-[#1B1B1B]"
                style={{ height: `${barWidths[i]}%`, transition: "height 0.05s linear" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — scrolling images ── */}
      <div className="flex flex-1 flex-col gap-[4.2rem] py-[7.5vh]">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl"
            style={{ height: "49vh" }}
          >
            <Image
              src={step.img}
              alt={step.title.first + " " + step.title.last}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 55vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
