"use client";

import { useRef } from "react";
import { motion, useScroll, AnimatePresence } from "motion/react";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useScrollStepper } from "@/hooks/useScrollStepper";
import { RevealLine } from "@/components/ui/reveal-text";

const EASE = EASE_OUT_EXPO as [number, number, number, number];

const STEPS = [
  {
    title: "Full Transaction Management",
    line1: "Full",
    line2: "Transaction Management",
    body: "Manage your leads, transactions, and analytics all in one place with our custom CRM built exclusively for CnC agents.",
    image: "/images/join-slide-crm.png",
  },
  {
    title: "Personal webpage",
    line1: "Personal",
    line2: "webpage",
    body: "Your own professional profile page with stats, listings, and a contact form — all live on cncrealtygroup.com the moment you join.",
    image: "/images/join-slide-agent.png",
  },
  {
    title: "Custom CRM & Email",
    line1: "Custom",
    line2: "CRM & Email",
    body: "Send branded email campaigns and drip sequences to your leads directly from the CnC platform. No third-party tools needed.",
    image: "/images/join-slide-campaign.png",
  },
];

export function JoinStepsSlider() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const { activeIdx: activeStep, scrollDirRef, barWidths } = useScrollStepper(scrollYProgress, STEPS.length);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="light"
      className="bg-white"
      style={{ height: "300vh" }}
    >
      {/* Sticky panel — inset 1.5rem from sides and bottom, below navbar */}
      <div
        className="flex gap-3 overflow-hidden"
        style={{
          position: "sticky",
          top: "5.5rem",
          height: "calc(100vh - 7.5rem)",
          margin: "0 1.5rem 1.5rem",
        }}
      >
        {/* Image — aspect-video box fills to corners so rounded-2xl is visible */}
        <div className="order-2 flex-1 min-w-0 flex items-center p-4">
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18),0_8px_20px_rgba(0,0,0,0.10)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ clipPath: scrollDirRef.current === "down" ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)" }}
                animate={{ clipPath: "inset(0 0 0 0)" }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 1.4, ease: EASE }}
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={STEPS[activeStep].image} alt={STEPS[activeStep].title} className="w-full h-full object-cover" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right — step content panel */}
        <div
          className="order-1 flex h-full flex-col rounded-2xl bg-[#DAD4D2]"
          style={{ width: "35%", padding: "3rem" }}
        >
          {/* Progress bars */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="flex-1 overflow-hidden"
                style={{ height: "2px", backgroundColor: "rgba(27,27,27,0.12)" }}
              >
                <div
                  className="h-full bg-[#1B1B1B]"
                  style={{
                    width: `${barWidths[i]}%`,
                    transition: "width 0.05s linear",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Slide title — upper left, below progress bars */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${activeStep}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="mt-6"
            >
              <h2 className="font-sans leading-[1.1]">
                <span className="block font-light" style={{ fontSize: "clamp(1.2rem, 1.6vw, 1.5rem)" }}>
                  <RevealLine triggerOnMount>{STEPS[activeStep].line1}</RevealLine>
                </span>
                <span className="block font-light" style={{ fontSize: "clamp(1.7rem, 2.3vw, 2.2rem)" }}>
                  <RevealLine triggerOnMount delay={0.1}>
                    <span style={{ color: "#9E8C61" }}>{STEPS[activeStep].line2}</span>
                  </RevealLine>
                </span>
              </h2>
            </motion.div>
          </AnimatePresence>

          {/* Step body — vertically centered */}
          <div className="flex flex-1 items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${activeStep}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <p
                  className="font-sans text-base leading-relaxed text-[#1B1B1B]"
                  style={{ maxWidth: "42ch" }}
                >
                  {STEPS[activeStep].body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
