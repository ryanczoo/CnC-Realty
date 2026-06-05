"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useScroll } from "motion/react";
import Image from "next/image";
import { useScrollStepper } from "@/hooks/useScrollStepper";

const STEPS = [
  {
    title: "Get Pre-Approved",
    body: "Connect with a lender to understand your budget before you fall in love with a home. Our agents can refer you to trusted local lenders.",
    img: "/images/sell/sell-06.jpg",
  },
  {
    title: "Find Your Agent",
    body: "Every CnC agent is a local California expert. Match with someone who knows your target neighborhoods inside and out.",
    img: "/images/sell/sell-07.jpg",
  },
  {
    title: "Search & Tour",
    body: "Browse live CRMLS listings updated every 15 minutes. Schedule tours directly and move fast when the right home appears.",
    img: "/images/sell/sell-08.jpg",
  },
  {
    title: "Closing Escrow",
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
    <section ref={sectionRef} className="relative flex bg-[#F2F0EF]">

      {/* ── Left panel — sticky ──
          flex-col justify-between mirrors Volta's layout:
          heading anchored top, counter+body anchored bottom.
          self-start prevents flex stretching which would break sticky. */}
      <div className="sticky top-0 flex h-screen w-[42%] flex-col justify-between self-start pb-16 pl-20 pr-12 pt-32">

        {/* TOP — step heading, left-aligned */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={`title-${activeIdx}`}
            className="font-sans text-[3.5rem] font-light leading-tight text-[#1B1B1B] xl:text-[4.5rem]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.55, ease: "easeOut" } }}
            exit={{ opacity: 0, y: -30, transition: { duration: 0.35, ease: "easeIn" } }}
          >
            {active.title}
          </motion.h2>
        </AnimatePresence>

        {/* BOTTOM — counter above body text, left-aligned */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`body-${activeIdx}`}
            className="flex flex-col gap-3"
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

      {/* ── Progress bar — centred between panels ── */}
      <div className="sticky top-0 flex h-screen w-8 flex-col items-center justify-center self-start">
        <div className="flex flex-col gap-1" style={{ width: 2, height: 260 }}>
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
      <div className="flex w-[58%] flex-col gap-6 py-[7.5vh] pr-20">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl"
            style={{ height: "85vh" }}
          >
            <Image
              src={step.img}
              alt={step.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 58vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
